#!/usr/bin/env node
/**
 * Produces an isolated, unsigned, non-publishing installer for this fork.
 * Only an explicit --apply may overwrite the local electron-builder.json.
 * Never use this configuration for upstream releases or signed distribution.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PREVIEW_APP_ID = 'com.sidhulyalkar.iptvnator.preview';
export const PREVIEW_PRODUCT_NAME = 'IPTVnator Preview';
export const PREVIEW_RELEASES_URL =
    'https://github.com/sidhulyalkar/iptvnator/releases';
export const PREVIEW_OUTPUT_DIRECTORY = 'dist/installer-preview';

export function createForkPreviewInstallerConfig(config, platform, arch) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new TypeError('Expected Electron Builder JSON object.');
    }
    if (!['windows', 'macos', 'linux'].includes(platform)) {
        throw new Error('Platform must be windows, macos, or linux.');
    }
    if (!['x64', 'arm64'].includes(arch) ||
        (platform !== 'macos' && arch !== 'x64')) {
        throw new Error('Unsupported installer architecture.');
    }
    const next = structuredClone(config);
    next.appId = PREVIEW_APP_ID;
    next.productName = PREVIEW_PRODUCT_NAME;
    next.artifactName = 'IPTVnator-Preview-\u0024{version}-\u0024{os}-\u0024{arch}.\u0024{ext}';
    next.directories = {
        ...(next.directories || {}),
        output: PREVIEW_OUTPUT_DIRECTORY,
    };
    // No update manifest, upstream signing or repository publication.
    next.publish = null;
    next.fileAssociations = [];
    next.extraMetadata = {
        ...(next.extraMetadata || {}),
        productName: PREVIEW_PRODUCT_NAME,
        desktopName: 'iptvnator-preview',
    };
    if (platform === 'windows') {
        next.win = {
            ...(next.win || {}),
            target: [
                { target: 'nsis', arch: ['x64'] },
                { target: 'zip', arch: ['x64'] },
            ],
            artifactName: 'IPTVnator-Preview-\u0024{version}-windows-\u0024{arch}-setup.\u0024{ext}',
        };
        next.nsis = {
            ...(next.nsis || {}),
            artifactName: 'IPTVnator-Preview-\u0024{version}-windows-\u0024{arch}-setup.\u0024{ext}',
        };
    } else if (platform === 'macos') {
        next.mac = {
            ...(next.mac || {}),
            target: [{ target: 'zip', arch: [arch] }],
            forceCodeSigning: false,
            identity: null,
            notarize: false,
            artifactName: 'IPTVnator-Preview-\u0024{version}-mac-\u0024{arch}.\u0024{ext}',
        };
    } else {
        next.linux = {
            ...(next.linux || {}),
            executableName: 'iptvnator-preview',
            target: [{ target: 'deb', arch: ['x64'] }],
            artifactName: 'IPTVnator-Preview-\u0024{version}-linux-\u0024{arch}.\u0024{ext}',
        };
        next.appImage = {
            ...(next.appImage || {}),
            desktop: {
                ...((next.appImage || {}).desktop || {}),
                entry: {
                    ...(((next.appImage || {}).desktop || {}).entry || {}),
                    'X-AppImage-Name': PREVIEW_PRODUCT_NAME,
                    'X-AppImage-Homepage': PREVIEW_RELEASES_URL,
                    'X-AppImage-UpdateURL': PREVIEW_RELEASES_URL,
                },
            },
        };
    }
    return next;
}

const invokedDirectly = process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    const args = process.argv.slice(2);
    if (args.length !== 3 || args[0] !== '--apply') {
        console.error('Usage: node tools/packaging/fork-preview-installer.mjs --apply <windows|macos|linux> <x64|arm64>');
        process.exit(2);
    }
    const jsonPath = path.join(process.cwd(), 'electron-builder.json');
    const config = createForkPreviewInstallerConfig(
        JSON.parse(fs.readFileSync(jsonPath, 'utf8')), args[1], args[2]
    );
    fs.writeFileSync(jsonPath, JSON.stringify(config, null, 4) + '\n');
    console.log('[preview-installer] Isolated identity; no publisher; ' +
        args[1] + '-' + args[2] + '; output: ' + PREVIEW_OUTPUT_DIRECTORY);
}
