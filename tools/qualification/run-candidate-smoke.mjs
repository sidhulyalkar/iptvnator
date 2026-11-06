#!/usr/bin/env node
/**
 * Fast, exact-spec regression reproducer for the current Unified TV release
 * candidate. Full project test suites stay mandatory in the release gate.
 * No fake pass or test exclusions are permitted here.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../../', import.meta.url));
const nodeOptions = [process.env.NODE_OPTIONS ?? '', '--experimental-vm-modules', '--max-old-space-size=4096']
    .filter(Boolean).join(' ');
const env = {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
    CI: process.env.CI ?? 'true',
    NX_DAEMON: 'false',
};
const jestPath = './node_modules/jest/bin/jest.js';
const cases = [
    {
        name: 'Electron scoped header leases',
        config: 'apps/electron-backend/jest.config.ts',
        paths: [
            'apps/electron-backend/src/app/services/scoped-stream-header-lease.spec.ts',
            'apps/electron-backend/src/app/services/request-header-overrides.service.spec.ts',
            'apps/electron-backend/src/app/events/shared.events.spec.ts',
        ],
    },
    {
        name: 'OnPush player and stream-header handoff',
        config: 'jest.web-esm.workspace.ts',
        paths: [
            'libs/ui/playback/src/lib/web-player-view/web-player-view.component.shared-controls.spec.ts',
            'libs/ui/playback/src/lib/web-player-view/electron-stream-headers.service.spec.ts',
        ],
    },
];
for (const item of cases) {
    console.log('[candidate-smoke] ' + item.name);
    const args = [
        jestPath, '--config', item.config,
        '--runInBand', '--runTestsByPath',
        ...item.paths,
    ];
    const r = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' });
    if (r.error || r.status !== 0) {
        console.error('[candidate-smoke] FAILED: ' + item.name);
        process.exit(r.status ?? 1);
    }
}
// This Angular test project uses a CommonJS Jest setup through the Nx
// executor. Launching its Jest config under the ESM-mode harness above
// fails before tests execute ("module is not defined").
console.log('[candidate-smoke] Unified Live radio + history (full portal-shared-ui suite)');
const radio = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['nx', 'test', 'portal-shared-ui', '--runInBand', '--output-style=static'],
    {
        cwd,
        env: { ...env, NODE_OPTIONS: '--max-old-space-size=4096' },
        stdio: 'inherit',
        shell: process.platform === 'win32',
    },
);
if (radio.error || radio.status !== 0) {
    console.error('[candidate-smoke] FAILED: portal-shared-ui regression suite');
    process.exit(radio.status ?? 1);
}
console.log('[candidate-smoke] All focused contracts passed; building deployable PWA.');
const build = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['run', 'build:frontend:pwa'],
    { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' },
);
if (build.error || build.status !== 0) {
    console.error('[candidate-smoke] FAILED: production PWA build');
    process.exit(build.status ?? 1);
}
console.log('[candidate-smoke] Focused regressions and PWA build PASSED.');
