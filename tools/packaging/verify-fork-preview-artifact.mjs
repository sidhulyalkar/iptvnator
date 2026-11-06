#!/usr/bin/env node
/**
 * Verify a generated fork-only desktop archive before exposing it as an
 * installable GitHub Actions artifact. Uses the produced ASAR, not a mock.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
    PREVIEW_APP_ID, PREVIEW_PRODUCT_NAME, PREVIEW_OUTPUT_DIRECTORY,
} from './fork-preview-installer.mjs';

const require = createRequire(import.meta.url);
const { extractFile } = require('@electron/asar');

export function selectPreviewArtifacts(names, platform) {
    const targets = {
        windows: ['.exe', '.zip'],
        macos: ['.zip'],
        linux: ['.deb'],
    };
    if (!Object.hasOwn(targets, platform)) {
        throw new Error('Invalid preview artifact platform.');
    }
    return targets[platform].map(ext => {
        const matches = names.filter(name =>
            name.startsWith('IPTVnator-Preview-') && name.endsWith(ext));
        if (matches.length !== 1) {
            throw new Error('Expected exactly one ' + ext +
                ' preview artifact; found ' + matches.length);
        }
        return matches[0];
    });
}

export function findAsar(directory, depth = 5) {
    if (depth < 0 || !fs.existsSync(directory)) return null;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        if (item.isSymbolicLink()) continue;
        const location = path.join(directory, item.name);
        if (item.isFile() && item.name === 'app.asar') return location;
        if (item.isDirectory()) {
            const found = findAsar(location, depth - 1);
            if (found) return found;
        }
    }
    return null;
}

const direct = process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
    const [platform] = process.argv.slice(2);
    const workspace = process.cwd();
    const config = JSON.parse(fs.readFileSync(
        path.join(workspace, 'electron-builder.json'), 'utf8'));
    assert.equal(config.appId, PREVIEW_APP_ID);
    assert.equal(config.productName, PREVIEW_PRODUCT_NAME);
    assert.equal(config.publish, null);
    assert.deepEqual(config.fileAssociations, []);
    assert.equal(config.directories.output, PREVIEW_OUTPUT_DIRECTORY);
    const output = path.join(workspace, PREVIEW_OUTPUT_DIRECTORY);
    assert.ok(fs.existsSync(output), 'Preview output directory must exist');
    const artifacts = selectPreviewArtifacts(fs.readdirSync(output), platform);
    const asar = findAsar(output);
    assert.ok(asar, 'Packaged Electron app.asar must exist');
    const metadata = JSON.parse(extractFile(asar, 'package.json').toString());
    assert.equal(metadata.productName, PREVIEW_PRODUCT_NAME,
        'Packaged productName must differ from upstream IPTVnator');
    for (const name of artifacts) {
        const file = path.join(output, name);
        assert.ok(fs.statSync(file).size > 1000000,
            'Installer/ZIP is implausibly small: ' + name);
        const hash = createHash('sha256');
        const stream = fs.createReadStream(file);
        for await (const data of stream) hash.update(data);
        const digest = hash.digest('hex');
        fs.writeFileSync(file + '.sha256', digest + '  ' + name + '\n');
        console.log('[preview-installer] VALID ' + name +
            ' size=' + fs.statSync(file).size + ' SHA256=' + digest);
    }
    console.log('[preview-installer] Validated isolated ASAR: ' + asar);
}
