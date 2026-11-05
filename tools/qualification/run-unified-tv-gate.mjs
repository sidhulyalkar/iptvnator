/**
 * Local and Vercel release-candidate qualification.
 * Runs each heavyweight process serially to avoid 2 GB Node heap crashes
 * observed when several Nx/Jest workers ran in the same 8 GB builder.
 * A failure aborts the build; never publish a skipped or partial gate.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const stages = [
    ['App TypeScript', ['run', 'typecheck:ci']],
    ['All spec TypeScript', ['run', 'typecheck:spec']],
    ['Release notes', ['run', 'release:notes:validate']],
    ['Electron unit suite', ['nx', 'test', 'electron-backend', '--runInBand', '--output-style=static']],
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
process.stdout.write('\n[unified-tv-qualification] All gates passed.\n');
