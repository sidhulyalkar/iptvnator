/**
 * Release candidate and explicitly scoped browser-preview qualification.
 * Runs each heavyweight process serially to avoid 2 GB Node heap crashes
 * observed when several Nx/Jest workers ran in the same 8 GB builder.
 * A failure aborts the build; never publish a skipped or partial gate.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const scope = process.env.IPTVNATOR_QUALIFICATION_SCOPE ?? 'release';
if (scope !== 'release' && scope !== 'web') {
    console.error('[unified-tv-qualification] Invalid scope.');
    process.exit(1);
}
const stages = [
    ['App TypeScript', ['run', 'typecheck:ci']],
    ['All spec TypeScript', ['run', 'typecheck:spec']],
    ['Release notes', ['run', 'release:notes:validate']],
    ['Windows MPV pin freshness', ['exec', 'node', 'tools/qualification/check-windows-pin.mjs']],
    ['Windows MPV pin freshness tests', ['exec', 'node', '--test', 'tools/qualification/check-windows-pin.test.mjs']],
    ...(scope === 'release'
        ? [
            ['Electron unit suite', [
                'nx', 'test', 'electron-backend', '--runInBand',
                '--output-style=static',
            ]],
            ['macOS DMG transient retry contract', [
                'exec', 'node', '--test',
                'tools/packaging/retry-transient-macos-dmg.test.mjs',
            ]],
        ]
        : [
            ['Electron IPC pure unit contracts', [
                'nx', 'test', 'electron-backend', '--runInBand',
                '--runTestsByPath',
                'apps/electron-backend/src/app/services/scoped-stream-header-lease.spec.ts',
                'apps/electron-backend/src/app/services/request-header-overrides.service.spec.ts',
                'apps/electron-backend/src/app/events/shared.events.spec.ts',
                '--output-style=static',
            ]],
        ]),
    ['Affected UI and service suites', [
        'nx', 'run-many', '--target=test',
        '--projects=ui-playback,services,portal-stalker-feature,portal-shared-ui,ui-epg',
        '--parallel=1', '--output-style=static',
    ]],
    ['Angular PWA production build', [
        'nx', 'build', 'web', '--configuration=pwa', '--skip-nx-cache',
        '--output-style=static',
    ]],
];

const currentOptions = process.env.NODE_OPTIONS ?? '';
const nodeOptions = /--max-old-space-size(?:=|\s+)\d+/.test(currentOptions)
    ? currentOptions
    : [currentOptions, '--max-old-space-size=4096'].filter(Boolean).join(' ');
const env = {
    ...process.env,
    CI: process.env.CI ?? 'true',
    NX_DAEMON: 'false',
    NX_SKIP_NX_CACHE: 'true',
    NODE_OPTIONS: nodeOptions,
};
for (const [label, args] of stages) {
    process.stdout.write('\n[unified-tv-qualification] ' + label + '\n');
    const result = spawnSync(pnpm, args, {
        cwd: root,
        env,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (result.error) {
        console.error('[unified-tv-qualification] Unable to start ' + label);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error('[unified-tv-qualification] Failed: ' + label);
        process.exit(result.status ?? 1);
    }
}
process.stdout.write('\n[unified-tv-qualification] All ' + scope + ' gates passed.\n');
