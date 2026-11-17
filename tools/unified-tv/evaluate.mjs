import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(root, 'fixtures', name), 'utf8'));
export const catalog = read('catalog.json');
export const suite = read('queries.json');

const stop = new Set(['a', 'an', 'the', 'me', 'find', 'show', 'what', 'is', 'on', 'right', 'now', 'live', 'watch', 'tv', 'game', 'games', 'channel', 'channels', 'n', 'vs', 'v', 'versus', 'at']);
const normalize = (value) => String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = (value) => normalize(value).split(/\s+/).filter(w => w && !stop.has(w));

function programText(p) {
  const date = new Date(p.start);
  const dateText = date.toLocaleString('en-US', {timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric'});
  const monthShort = date.toLocaleString('en-US', {timeZone: 'UTC', month: 'short'});
  return [p.title, p.description, ...(p.aliases ?? []), p.league, p.sport, p.seriesTitle,
    p.season ? `season ${p.season}` : '', p.episode ? `episode ${p.episode}` : '',
    dateText, `${monthShort} ${date.getUTCDate()}`, p.start.slice(0, 10)].join(' ');
}

export function searchPrograms(query, data = catalog, now = data.referenceTime) {
  const queryWords = words(query);
  if (!queryWords.length) return [];
  const liveOnly = /\b(now|right now|live|currently)\b/i.test(query);
  const nowMs = Date.parse(now);
  return data.programs.flatMap(p => {
    const start = Date.parse(p.start);
    const end = Date.parse(p.end);
    const live = start <= nowMs && nowMs < end;
    if (liveOnly && !live) return [];
    const corpus = words(programText(p));
    if (!queryWords.every(w => corpus.includes(w))) return [];
    const title = normalize(p.title);
    const needle = normalize(query);
    const direct = needle === title || (p.aliases ?? []).some(a => normalize(a) === needle);
    const titleHits = queryWords.filter(w => words(title).includes(w)).length;
    const score = (direct ? 100 : 0) + titleHits * 10 + (live ? 8 : 0) + (p.kind === 'sports_event' ? 1 : 0);
    return [{ id: p.id, score, live }];
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

// Deliberately weak channel-name-only control, not the existing IPTVnator search implementation.
export function channelNameControl(query, data = catalog) {
  const terms = words(query);
  if (!terms.length) return [];
  const channelIds = new Set(data.channels.filter(c => {
    const channelWords = words([c.title, ...(c.aliases ?? [])].join(' '));
    return terms.every(w => channelWords.includes(w));
  }).map(c => c.id));
  return data.programs.filter(p => p.channelIds.some(id => channelIds.has(id))).map(p => ({id: p.id}));
}

export function scoreCases(search, cases = suite.cases) {
  let positive = 0, hitsAt1 = 0, hitsAt5 = 0, reciprocalRank = 0, negatives = 0, falsePositives = 0;
  for (const item of cases) {
    const results = search(item.query).map(x => x.id);
    if (item.expectedTopId === null) {
      negatives++;
      if (results.length) falsePositives++;
    } else {
      positive++;
      const rank = results.indexOf(item.expectedTopId);
      if (rank === 0) hitsAt1++;
      if (rank >= 0 && rank < 5) { hitsAt5++; reciprocalRank += 1 / (rank + 1); }
    }
  }
  const ratio = (numerator, denominator) => denominator ? Number((numerator / denominator).toFixed(3)) : 0;
  return { cases: cases.length, positive, negative: negatives, top1: ratio(hitsAt1, positive), recallAt5: ratio(hitsAt5, positive), mrrAt5: ratio(reciprocalRank, positive), falsePositiveRate: ratio(falsePositives, negatives) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({type: 'synthetic-reference-only', referenceTime: catalog.referenceTime,
    channelNameControl: scoreCases(channelNameControl), programMetadataReference: scoreCases(searchPrograms)}, null, 2));
}
