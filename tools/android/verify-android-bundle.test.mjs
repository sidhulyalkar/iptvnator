import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectBundle } from './verify-android-bundle.mjs';

function withFixture(fn) {
    const dir = mkdtempSync(join(tmpdir(), 'iptvnator-fire-'));
    try {
        mkdirSync(join(dir, 'assets'));
        writeFileSync(join(dir, 'index.html'),
            '<!doctype html><base href="/assets/"><link href="styles-abc.css" rel="stylesheet">' +
            '<script src="main-abc.js"></script><script src="assets/app-config.js"></script>');
        writeFileSync(join(dir, 'styles-abc.css'), '');
        writeFileSync(join(dir, 'main-abc.js'), '');
        writeFileSync(join(dir, 'assets/app-config.js'), '');
        fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('accepts a self-contained Android bundle', () => withFixture(dir => {
    assert.deepEqual(inspectBundle(dir), []);
}));

test('rejects web PWA base paths, service workers and missing chunks', () => withFixture(dir => {
    writeFileSync(join(dir, 'index.html'),
        '<base href="/"><script src="missing.js"></script>');
    writeFileSync(join(dir, 'ngsw-worker.js'), '');
    const issues = inspectBundle(dir).join('\n');
    assert.match(issues, /base href/);
    assert.match(issues, /service worker/i);
    assert.match(issues, /missing/i);
}));

test('rejects escaping paths instead of loading external files', () => withFixture(dir => {
    writeFileSync(join(dir, 'index.html'),
        '<base href="/assets/"><script src="../secret.js"></script><script src="main-abc.js"></script>');
    assert.match(inspectBundle(dir).join('\n'), /escaping/i);
}));
