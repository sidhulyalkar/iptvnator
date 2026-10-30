import { DatabaseSync } from 'node:sqlite';

/** Standalone FTS5 research index. Never connected to production playback. */
const WORDS_TO_IGNORE = new Set(['a','an','the','find','show','me','what','is','on','right','now','live','watch','tv','game','games','n','vs','v','at','versus','currently','upcoming']);
export function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu,' ').trim().replace(/\s+/g,' ');
}
function tokenize(value) { return normalize(value).split(' ').filter(x => x && !WORDS_TO_IGNORE.has(x)); }
function required(value, label) {
  if (typeof value !== 'string' || !value || value.length > 500) throw new TypeError('Invalid '+label);
  return value;
}
function instant(value) {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isSafeInteger(ms)) throw new TypeError('Invalid time');
  return ms;
}
function dateTokens(start, zone) {
  const timeZone = zone ?? 'UTC';
  if (typeof timeZone !== 'string' || timeZone.length > 80) throw new TypeError('Invalid timezone');
  const d = new Date(start);
  const parts = new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'long',day:'numeric'}).formatToParts(d);
  const x = Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return [x.month,x.day,x.year,new Intl.DateTimeFormat('en-US',{timeZone,month:'short'}).format(d)].join(' ');
}
function normalizeRow(r,source,provider) {
  if (r.sourceId && r.sourceId !== source) throw new TypeError('Source mismatch');
  const channel = required(r.channelId,'channelId'), program = required(r.programId,'programId');
  const start = instant(r.start), stop = instant(r.end);
  if (start >= stop) throw new TypeError('Invalid interval');
  const aliases = r.aliases ?? [];
  if (!Array.isArray(aliases) || aliases.some(x=>typeof x!=='string')) throw new TypeError('Invalid aliases');
  if (!['sports_event','episode','program','movie','series'].includes(r.kind)) throw new TypeError('Invalid kind');
  const season = r.season ?? null, episode = r.episode ?? null;
  if ([season,episode].some(x=>x!==null&&(!Number.isInteger(x)||x<0))) throw new TypeError('Invalid episode');
  return {
    source,provider,channel,program,
    content: r.canonicalContentId ? required(r.canonicalContentId,'canonicalContentId')
      : JSON.stringify([source,provider,channel,program]),
    kind:r.kind,title:required(r.title,'title'),description:String(r.description??'').slice(0,4000),
    aliases:JSON.stringify(aliases),league:String(r.league??''),sport:String(r.sport??''),
    series:String(r.seriesTitle??''),season,episode,
    searchContext:[dateTokens(start,r.timeZone),season===null?'':'season '+season,episode===null?'':'episode '+episode].join(' '),
    start,stop,epg:String(r.epgId??'')
  };
}
export class ShadowSearch {
  constructor(path=':memory:') {
    this.db=new DatabaseSync(path);
    this.db.exec("CREATE TABLE IF NOT EXISTS airings (id INTEGER PRIMARY KEY, source TEXT, provider TEXT, channel TEXT, program TEXT, content TEXT, kind TEXT, title TEXT, description TEXT, aliases TEXT, league TEXT, sport TEXT, series TEXT, season INTEGER, episode INTEGER, context TEXT, start INTEGER, stop INTEGER, epg TEXT, UNIQUE(source,provider,channel,program));");
    this.db.exec("CREATE INDEX IF NOT EXISTS airings_source ON airings(source);");
    this.db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS airings_fts USING fts5(title,description,aliases,league,sport,series,context,content='airings',content_rowid='id',tokenize='unicode61 remove_diacritics 2');");
    this.db.exec("CREATE TRIGGER IF NOT EXISTS airings_ai AFTER INSERT ON airings BEGIN INSERT INTO airings_fts(rowid,title,description,aliases,league,sport,series,context) VALUES (new.id,new.title,new.description,new.aliases,new.league,new.sport,new.series,new.context); END;");
    this.db.exec("CREATE TRIGGER IF NOT EXISTS airings_ad AFTER DELETE ON airings BEGIN INSERT INTO airings_fts(airings_fts,rowid,title,description,aliases,league,sport,series,context) VALUES ('delete',old.id,old.title,old.description,old.aliases,old.league,old.sport,old.series,old.context); END;");
    this.insert=this.db.prepare('INSERT INTO airings(source,provider,channel,program,content,kind,title,description,aliases,league,sport,series,season,episode,context,start,stop,epg) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    this.erase=this.db.prepare('DELETE FROM airings WHERE source=?');
  }
  replaceSource(source,provider,rows,options={}) {
    required(source,'source');
    if (!['m3u','xtream','stalker'].includes(provider)) throw new TypeError('Invalid provider');
    if (options.complete!==true) throw new TypeError('Incomplete snapshot');
    if (!Array.isArray(rows)||rows.length>100000) throw new TypeError('Invalid snapshot rows');
    if (options.expectedCount!==undefined && options.expectedCount!==rows.length) throw new TypeError('Incomplete snapshot count');
    const valid=rows.map(r=>normalizeRow(r,source,provider));
    const seen=new Set();
    for(const r of valid) {
      const key=JSON.stringify([r.channel,r.program]);
      if(seen.has(key))throw new TypeError('Duplicate occurrence');
      seen.add(key);
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.erase.run(source);
      for(const r of valid)this.insert.run(r.source,r.provider,r.channel,r.program,r.content,r.kind,r.title,r.description,r.aliases,r.league,r.sport,r.series,r.season,r.episode,r.searchContext,r.start,r.stop,r.epg);
      this.db.exec('COMMIT');
    } catch(e) {this.db.exec('ROLLBACK');throw e;}
    return valid.length;
  }
  search(query, options={}) {
    if(typeof query!=='string'||query.length>200)return [];
    const terms=[...new Set(tokenize(query))];
    if(!terms.length||terms.length>14)return [];
    const now=instant(options.now??Date.now());
    const liveOnly=/\b(now|live|currently)\b/i.test(query);
    const upcomingOnly=/\b(upcoming|future)\b/i.test(query);
    if(liveOnly&&upcomingOnly)return [];
    const conditions=liveOnly?'AND a.start <= ? AND a.stop > ?':upcomingOnly?'AND a.start > ?':'';
    const match=terms.map(t=>'"'+t.replaceAll('"','""')+'"').join(' AND ');
    const binds=[match,...(liveOnly?[now,now]:upcomingOnly?[now]:[]),now,now,500];
    const rows=this.db.prepare('SELECT a.*,bm25(airings_fts) AS rank FROM airings_fts JOIN airings a ON a.id=airings_fts.rowid WHERE airings_fts MATCH ? '+conditions+' ORDER BY CASE WHEN a.start<=? AND a.stop>? THEN 0 ELSE 1 END,rank ASC,a.start ASC LIMIT ?').all(...binds);
    const needle=normalize(query), fav=new Set(options.favoriteChannels??[]);
    const items=new Map();
    for(const r of rows) {
      const live=r.start<=now&&r.stop>now;
      const exact=normalize(r.title)===needle||JSON.parse(r.aliases).some(a=>normalize(a)===needle);
      const key=JSON.stringify([r.source,r.provider,r.channel]);
      const score=(exact?1000:0)+terms.filter(t=>normalize(r.title).split(' ').includes(t)).length*20+(live?40:0)+(fav.has(key)?8:0);
      const option={sourceId:r.source,provider:r.provider,channelId:r.channel,epgId:r.epg||null,start:new Date(r.start).toISOString(),end:new Date(r.stop).toISOString(),playbackStatus:'unknown'};
      const previous=items.get(r.content);
      if(previous){previous.viewingOptions.push(option);if(score>previous.score){previous.score=score;previous.live=live;previous.title=r.title;}}
      else items.set(r.content,{id:r.content,title:r.title,kind:r.kind,live,score,evidence:{method:'fts5',terms},viewingOptions:[option]});
    }
    return [...items.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,Math.min(100,Math.max(1,Number.isInteger(options.limit)?options.limit:30)));
  }
  count(source){return Number(this.db.prepare('SELECT COUNT(*) AS n FROM airings WHERE source=?').get(source).n);}
  close(){this.db.close();}
}
export function seedSynthetic(index,fixture) {
  const channels=new Map(fixture.channels.map(c=>[c.id,c]));
  for(const source of fixture.sources) {
    const rows=[];
    for(const p of fixture.programs)for(const id of p.channelIds){
      const c=channels.get(id);if(c?.sourceId!==source.id)continue;
      rows.push({channelId:c.providerChannelId,programId:p.id,canonicalContentId:p.id,kind:p.kind,title:p.title,description:p.description,aliases:p.aliases,league:p.league,sport:p.sport,seriesTitle:p.seriesTitle,season:p.season,episode:p.episode,start:p.start,end:p.end,epgId:c.tvgId});
    }
    index.replaceSource(source.id,source.kind,rows,{complete:true,expectedCount:rows.length});
  }
}
