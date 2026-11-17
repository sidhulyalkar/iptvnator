import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
    selectPreviewArtifacts,
    findAsar,
} from './verify-fork-preview-artifact.mjs';

test('requires all expected formats with unique preview names', () => {
    assert.deepEqual(selectPreviewArtifacts([
        'IPTVnator-Preview-0.25.0-windows-x64-setup.exe',
        'IPTVnator-Preview-0.25.0-windows-x64-setup.zip',
    ], 'windows').length, 2);
    assert.throws(() => selectPreviewArtifacts(['IPTVnator-0.25.0.exe'], 'windows'));
    assert.throws(() => selectPreviewArtifacts([], 'linux'));
    assert.throws(() => selectPreviewArtifacts([], 'invalid'));
});
test('discovers the actual packaged ASAR without following symlinks', () => {
    const root = mkdtempSync(join(tmpdir(), 'iptvnator-preview-package-'));
    try {
        mkdirSync(join(root, 'linux-unpacked', 'resources'), { recursive: true });
        const location = join(root, 'linux-unpacked', 'resources', 'app.asar');
        writeFileSync(location, 'fake fixture');
        assert.equal(findAsar(root), location);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
