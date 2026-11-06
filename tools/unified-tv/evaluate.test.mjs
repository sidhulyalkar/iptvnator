import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { catalog, suite, searchPrograms, channelNameControl, scoreCases } from './evaluate.mjs';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('synthetic catalog has unique typed IDs and valid source references', () => {
  assert.equal(catalog.fixtureOnly, true);
  assert.equal(suite.fixtureOnly, true);
  const sources = new Map(catalog.sources.map(s => [s.id, s]));
  const channels = new Map(catalog.channels.map(c => [c.id, c]));
  const ids = catalog.programs.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(channels.keys()).size, catalog.channels.length);
  for (const channel of channels.values()) {
    assert.ok(sources.has(channel.sourceId));
    assert.equal(channel.playbackStatus, 'unknown', 'synthetic metadata must not imply playable video');
  }
  for (const p of catalog.programs) {
    assert.ok(Date.parse(p.start) < Date.parse(p.end));
    assert.ok(p.channelIds.length);
    for (const id of p.channelIds) assert.ok(channels.has(id), `${p.id}: unknown ${id}`);
  }
});

test('M3U and XMLTV fixture channel IDs agree and contain no usable media endpoints', () => {
  const m3u = readFileSync(join(fixtureDir, 'lineup.m3u'), 'utf8');
  const xml = readFileSync(join(fixtureDir, 'guide.xml'), 'utf8');
  assert.ok(m3u.startsWith('#EXTM3U'));
  const ids = [...m3u.matchAll(/tvg-id="([^"]+)"/g)].map(m => m[1]);
  const xmlIds = new Set([...xml.matchAll(/<channel id="([^"]+)">/g)].map(m => m[1]));
  assert.equal(ids.length, 5);
  for (const id of ids) assert.ok(xmlIds.has(id), `EPG missing: ${id}`);
  for (const c of catalog.channels.filter(c => c.sourceId === 'source-m3u')) assert.ok(ids.includes(c.tvgId));
  const urls = m3u.split('\n').filter(line => line.startsWith('https:'));
  assert.equal(urls.length, 5);
  assert.ok(urls.every(url => url.startsWith('https://example.invalid/')));
});

test('same EPG channel mapping across providers does not collapse logical channel identities', () => {
  const variants = catalog.channels.filter(c => c.tvgId === 'gridiron.example');
  assert.equal(variants.length, 3);
  assert.equal(new Set(variants.map(c => `${c.sourceId}:${c.providerChannelId}`)).size, 3);
  assert.deepEqual(variants.map(c => c.playbackStatus), ['unknown', 'unknown', 'unknown']);
});

test('EPG explicitly has timezone-offset test data', () => {
  const xml = readFileSync(join(fixtureDir, 'guide.xml'), 'utf8');
  assert.match(xml, /start="20261101110000 -0700"/);
  assert.equal(Date.parse('2026-11-01T11:00:00-07:00'), Date.parse('2026-11-01T18:00:00Z'));
});

test('all golden cases have known target identities, including negative no-match cases', () => {
  const ids = new Set(catalog.programs.map(p => p.id));
  for (const item of suite.cases) {
    assert.ok(item.query && item.category);
    if (item.expectedTopId !== null) assert.ok(ids.has(item.expectedTopId), item.query);
  }
  assert.ok(suite.cases.some(c => c.expectedTopId === null));
});

test('reference search handles voice aliases, dates, live filtering, and unknown matchups', () => {
  for (const item of suite.cases) {
    const results = searchPrograms(item.query);
    assert.equal(results[0]?.id ?? null, item.expectedTopId, `query: ${item.query}`);
  }
  assert.equal(searchPrograms('NFL live', catalog, '2026-11-01T22:00:00Z').length, 0);
  assert.equal(searchPrograms('Packers vs Panthers')[0]?.live, true);
  assert.equal(searchPrograms('Packers at Lions')[0]?.live, false);
});

test('the richer reference is no worse than the channel-name-only control on the fixed corpus', () => {
  const bare = scoreCases(channelNameControl);
  const richer = scoreCases(searchPrograms);
  assert.ok(richer.recallAt5 >= bare.recallAt5);
  assert.ok(richer.top1 >= bare.top1);
  assert.equal(richer.falsePositiveRate, 0);
});
