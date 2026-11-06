import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
    createForkPreviewInstallerConfig,
    PREVIEW_APP_ID, PREVIEW_PRODUCT_NAME, PREVIEW_OUTPUT_DIRECTORY,
    PREVIEW_RELEASES_URL,
} from './fork-preview-installer.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const original = JSON.parse(
    fs.readFileSync(join(root, 'electron-builder.json'), 'utf8')
);

for (const [platform, arch] of [
    ['windows', 'x64'], ['macos', 'arm64'],
    ['macos', 'x64'], ['linux', 'x64'],
]) {
    test(platform + '-' + arch + ' builds a unique, non-publishing preview', () => {
        const config = createForkPreviewInstallerConfig(original, platform, arch);
        assert.equal(config.appId, PREVIEW_APP_ID);
        assert.equal(config.productName, PREVIEW_PRODUCT_NAME);
        assert.equal(config.publish, null);
        assert.deepEqual(config.fileAssociations, []);
        assert.equal(config.directories.output, PREVIEW_OUTPUT_DIRECTORY);
        assert.equal(config.extraMetadata.productName, PREVIEW_PRODUCT_NAME);
        assert.notEqual(config.appId, original.appId);
        assert.notEqual(config.directories.output, original.directories.output);
        assert.equal(original.productName, 'IPTVnator');
        assert.equal(original.publish[0].owner, '4gray');
        if (platform === 'windows') {
            assert.deepEqual(config.win.target.map(t => t.target), ['nsis', 'zip']);
            assert.ok(config.win.artifactName.includes('Preview'));
        }
        if (platform === 'macos') {
            assert.deepEqual(config.mac.target, [{ target: 'zip', arch: [arch] }]);
            assert.equal(config.mac.forceCodeSigning, false);
            assert.equal(config.mac.notarize, false);
            assert.equal(config.mac.identity, null);
        }
        if (platform === 'linux') {
            assert.equal(config.linux.executableName, 'iptvnator-preview');
            assert.deepEqual(config.linux.target, [{target: 'deb', arch: ['x64']}]);
            assert.equal(config.appImage.desktop.entry['X-AppImage-UpdateURL'], PREVIEW_RELEASES_URL);
        }
    });
}
test('rejects unsupported targets instead of accidentally shipping mixed architectures', () => {
    assert.throws(() => createForkPreviewInstallerConfig(original, 'windows', 'arm64'));
    assert.throws(() => createForkPreviewInstallerConfig(original, 'linux', 'arm64'));
    assert.throws(() => createForkPreviewInstallerConfig(original, 'bad', 'x64'));
    assert.throws(() => createForkPreviewInstallerConfig(original, 'macos', 'bad'));
});
