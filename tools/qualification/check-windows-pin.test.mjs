import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectWindowsPin, PIN_MAX_AGE_DAYS } from './check-windows-pin.mjs';

const release = { publishedAt: '2026-11-04T19:42:56Z' };
test('new Windows MPV pin passes the release freshness gate', () => {
    assert.equal(inspectWindowsPin(release, new Date('2026-11-04T23:42:56Z')).ok, true);
});
test('pin expires early enough for the 30-day archive retention horizon', () => {
    const at = new Date(Date.parse(release.publishedAt) + PIN_MAX_AGE_DAYS * 86400_000);
    assert.deepEqual(
        { ok: inspectWindowsPin(release, at).ok, reason: inspectWindowsPin(release, at).reason },
        { ok: false, reason: 'refresh-required' }
    );
});
test('future or unparseable timestamps cannot bypass the age check', () => {
    assert.equal(inspectWindowsPin({ publishedAt: 'not a date' }).ok, false);
    assert.equal(inspectWindowsPin({ publishedAt: '2030-01-01T00:00:00Z' }, new Date('2026-11-04')).ok, false);
});
