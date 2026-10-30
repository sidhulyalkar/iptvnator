import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ShadowSearch,seedSynthetic,normalize} from './shadow-search.mjs';
import {catalog,suite,scoreCases} from './evaluate.mjs';
const make=()=>{const s=new ShadowSearch();seedSynthetic(s,catalog);return s;};
const item=(extra={})=>({programId:'p',channelId:'c',kind:'sports_event',title:'Owls vs Falcons',description:'Synthetic football matchup',league:'NFL',sport:'football',start:'2026-11-01T18:00:00Z',end:'2026-11-01T21:00:00Z',...extra});
test('matches every frozen sports, EPG, episode, date and negative query',()=>{
 const s=make();try{
  for(const c of suite.cases)assert.equal(s.search(c.query,{now:catalog.referenceTime})[0]?.id??null,c.expectedTopId,c.query);
  assert.equal(scoreCases(q=>s.search(q,{now:catalog.referenceTime})).top1,1);
 }finally{s.close();}
});
test('preserves three independent provider options without playable URLs',()=>{
 const s=make();try{
  const x=s.search('Packers vs Panthers',{now:catalog.referenceTime})[0];
  assert.equal(x.viewingOptions.length,3);
  assert.deepEqual(x.viewingOptions.map(i=>i.provider).sort(),['m3u','stalker','xtream']);
  assert.ok(x.viewingOptions.every(i=>i.playbackStatus==='unknown'&&!('streamUrl' in i)));
 }finally{s.close();}
});
test('does not canonicalize an identical EPG/title across unverified providers',()=>{
 const s=new ShadowSearch();try{
  s.replaceSource('a','m3u',[item()],{complete:true});
  s.replaceSource('b','xtream',[item()],{complete:true});
  assert.equal(s.search('Owls vs Falcons',{now:catalog.referenceTime}).length,2);
 }finally{s.close();}
});
test('refresh is source-scoped, stale FTS rows disappear and incomplete snapshots preserve old data',()=>{
 const s=new ShadowSearch();try{
  s.replaceSource('a','m3u',[item()],{complete:true});
  s.replaceSource('b','xtream',[item({title:'Tigers vs Bears'})],{complete:true});
  assert.throws(()=>s.replaceSource('a','m3u',[]),/Incomplete/);
  assert.throws(()=>s.replaceSource('a','m3u',[item(),item()],{complete:true}),/Duplicate/);
  assert.throws(()=>s.replaceSource('a','m3u',[],{complete:true,expectedCount:1}),/Incomplete/);
  assert.equal(s.count('a'),1);
  s.replaceSource('a','m3u',[item({title:'Lions vs Wolves'})],{complete:true});
  assert.equal(s.search('Owls').length,0);
  assert.equal(s.search('Lions').length,1);
  assert.equal(s.search('Tigers').length,1);
 }finally{s.close();}
});
test('time filtering, query injection protection and Unicode remain safe',()=>{
 const s=make();try{
  assert.equal(normalize('İSTANBUL Café'),'istanbul cafe');
  assert.equal(s.search('NFL live',{now:'2026-11-01T21:00:00Z'}).length,0);
  assert.equal(s.search('NFL upcoming',{now:catalog.referenceTime})[0].id,'event-packers-lions');
  for(const q of ['NFL" OR "news',"'; DROP TABLE airings; --",'x'.repeat(10000)])
    assert.doesNotThrow(()=>s.search(q));
  assert.equal(s.count('source-m3u'),6);
 }finally{s.close();}
});
test('can index and refresh 2000 independent airings',()=>{
 const s=new ShadowSearch();try{
  const rows=Array.from({length:2000},(_,i)=>item({programId:'p'+i,title:'Owls Falcons '+i}));
  s.replaceSource('large','m3u',rows,{complete:true});
  assert.equal(s.search('Owls Falcons 1999')[0].viewingOptions.length,1);
  s.replaceSource('large','m3u',rows,{complete:true});
  assert.equal(s.count('large'),2000);
 }finally{s.close();}
});
