import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRetryTransientDmg } from './retry-transient-macos-dmg.mjs';

const transient = 'dmgbuild.core.DMGError: Unable to detach device cleanly: hdiutil: couldn\'t eject disk2 - Resource busy';

test('retries only diagnosed Intel macOS dmg eject races', () => {
    assert.equal(shouldRetryTransientDmg(transient, 'darwin', 'x64'), true);
    assert.equal(shouldRetryTransientDmg(transient, 'darwin', 'arm64'), false);
    assert.equal(shouldRetryTransientDmg(transient, 'win32', 'x64'), false);
    assert.equal(shouldRetryTransientDmg('Resource busy during video playback', 'darwin', 'x64'), false);
    assert.equal(shouldRetryTransientDmg('DMGError: signature invalid', 'darwin', 'x64'), false);
});
