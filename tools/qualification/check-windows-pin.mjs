/**
 * Non-network release-candidate guard: checked-in Windows binary pin must be
 * fresh enough to survive the upstream 30-day retention window.
 * The full packaged build separately downloads and hashes the actual binary.
 */
import { readWindowsRuntimePin } from '../embedded-mpv/windows-runtime-pin.mjs';
import { runtimePinAgeDays } from '../embedded-mpv/update-windows-runtime-pin.mjs';
import { pathToFileURL } from 'node:url';

export const PIN_MAX_AGE_DAYS = 21;

export function inspectWindowsPin(pin, now = new Date()) {
    const ageDays = runtimePinAgeDays(pin, now);
    if (!Number.isFinite(ageDays) || ageDays < -1) {
        return { ok: false, reason: 'invalid-published-date', ageDays };
    }
    if (ageDays >= PIN_MAX_AGE_DAYS) {
        return { ok: false, reason: 'refresh-required', ageDays };
    }
    return { ok: true, reason: 'fresh', ageDays };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const pin = readWindowsRuntimePin();
    const status = inspectWindowsPin(pin);
    if (!status.ok) {
        console.error('Windows MPV pin is not release-fresh. Refresh the checksum-pinned upstream archive.');
        process.exitCode = 1;
    } else {
        console.log('Windows MPV pin metadata is release-fresh (' +
            pin.releaseTag + ', age ' + status.ageDays.toFixed(1) + ' days).');
    }
}
