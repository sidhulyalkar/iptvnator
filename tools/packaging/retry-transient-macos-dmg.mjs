#!/usr/bin/env node
/**
 * Retry exactly one diagnosed macOS Intel dmgbuild eject race.
 * A failed build never becomes a success without a new successful make.
 * Other platforms, architectures, and errors are not retried.
 */
import { spawn } from 'node:child_process';

const ARGUMENTS = ['run', 'make:app', '--', '--publishPolicy=never'];
const LOG_LIMIT = 48 * 1024;

export function shouldRetryTransientDmg(log, platform, arch) {
    return platform === 'darwin' &&
        arch === 'x64' &&
        /Unable to detach device cleanly/.test(log) &&
        /Resource busy/.test(log);
}

function runMake() {
    return new Promise((resolve) => {
        let log = '';
        const runner = spawn('pnpm', ARGUMENTS, {
            stdio: ['inherit', 'pipe', 'pipe'],
            env: process.env,
        });
        for (const [stream, output] of [
            [runner.stdout, process.stdout],
            [runner.stderr, process.stderr],
        ]) {
            stream?.on('data', (chunk) => {
                const text = chunk.toString('utf8');
                log = (log + text).slice(-LOG_LIMIT);
                output.write(chunk);
            });
        }
        runner.once('error', () => resolve({ ok: false, code: 1, log }));
        runner.once('close', (code, signal) =>
            resolve({ ok: code === 0, code: code ?? 1, signal, log })
        );
    });
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
    const first = await runMake();
    if (first.ok) {
        process.exit(0);
    }
    const intendedArch = process.env.IPTVNATOR_EMBEDDED_MPV_ARCH;
    if (
        first.signal ||
        !shouldRetryTransientDmg(first.log, process.platform, intendedArch)
    ) {
        process.exit(first.code);
    }
    console.warn(
        '[packaging] Intel macOS DMG temporary volume was busy. ' +
        'Retrying make once after the previous process exits.'
    );
    await new Promise((done) => setTimeout(done, 15_000));
    const second = await runMake();
    process.exit(second.ok ? 0 : second.code);
}
