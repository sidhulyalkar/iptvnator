import { Injectable } from '@angular/core';
import type { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';

function getHeaderValue(
    headers: ResolvedPortalPlayback['headers'] | undefined,
    name: string
): string | undefined {
    if (!headers) {
        return undefined;
    }

    const matchingKey = Object.keys(headers).find(
        (key) => key.toLowerCase() === name.toLowerCase()
    );
    return matchingKey ? headers[matchingKey] : undefined;
}

/**
 * Single owner of the scoped Electron request-header override for built-in
 * playback. There is exactly one scoped override slot in the main process, so
 * every surface that plays a stream inline goes through this service:
 * `WebPlayerViewComponent` for the web video players, plus the two surfaces
 * that render `AudioPlayerComponent` for radio and therefore never mount a
 * `WebPlayerViewComponent` at all — the Stalker live layout, and the unified
 * live tab behind the Favorites / Recently Viewed collection routes.
 *
 * `apply()` extracts the full header set from the resolved playback —
 * including the portal Cookie/Authorization that auth-gated streams require —
 * and hands it to the main process scoped to the stream's URL. A playback
 * without custom headers deliberately clears the previous scoped override so
 * stale headers never leak onto the next stream. `clear()` releases the slot
 * only while the caller's stream still owns it, so a consumer being destroyed
 * cannot wipe the override a newer consumer just configured.
 */
/** IPC registration must settle independently of the media/network timeout. */
export const ELECTRON_STREAM_HEADER_SETUP_TIMEOUT_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class ElectronStreamHeadersService {
    /** Guards against a superseded apply resolving its header IPC late. */
    private syncSequence = 0;
    /** Stream URL the currently configured override belongs to. */
    private currentScopeUrl: string | null = null;
    /** Unblocks an older pending consumer immediately on source replacement. */
    private cancelPendingApply: (() => void) | null = null;

    /**
     * Configures the scoped override for this playback. Resolves `true` when
     * this apply is still the newest one at the time the main process
     * acknowledged it — callers must only hand the source to a player on
     * `true`, so the first media request already carries the headers. Returns
     * null when there is no Electron bridge (PWA), where sources apply
     * synchronously and no override exists.
     */
    apply(playback: ResolvedPortalPlayback): Promise<boolean> | null {
        // A hanging IPC for channel A must not retain an awaiting audio/video
        // caller after channel B is selected, even when A never settles.
        this.cancelPendingApply?.();
        this.cancelPendingApply = null;
        // Feature-detect the actual method, not just the Electron bridge.
        if (typeof window.electron?.setUserAgent !== 'function') {
            return null;
        }

        const sequence = ++this.syncSequence;
        const userAgent =
            playback.userAgent ??
            getHeaderValue(playback.headers, 'User-Agent');
        const referer =
            playback.referer ?? getHeaderValue(playback.headers, 'Referer');
        const cookie = getHeaderValue(playback.headers, 'Cookie');
        const authorization = getHeaderValue(playback.headers, 'Authorization');

        this.currentScopeUrl = playback.streamUrl;
        // Do not log raw IPC exceptions: they can contain portal credentials.
        let ipc: Promise<boolean>;
        try {
            ipc = window.electron.setUserAgent(
                userAgent,
                referer,
                playback.streamUrl,
                cookie || authorization
                    ? { authorization, cookie }
                    : undefined
            );
        } catch {
            console.warn(
                '[ElectronStreamHeaders] Request-header setup failed'
            );
            return Promise.resolve(false);
        }

        return new Promise<boolean>((resolve) => {
            let settled = false;
            const settle = (succeeded: boolean, failed = false): void => {
                if (settled) return;
                settled = true;
                clearTimeout(deadline);
                if (this.cancelPendingApply === cancel) {
                    this.cancelPendingApply = null;
                }
                if (failed && sequence === this.syncSequence) {
                    console.warn(
                        '[ElectronStreamHeaders] Request-header setup failed'
                    );
                }
                resolve(succeeded && sequence === this.syncSequence);
            };
            const cancel = (): void => settle(false);
            // This is only the IPC handoff deadline, not media readiness.
            // A late fulfillment must never install a player from this result.
            const deadline = setTimeout(
                () => settle(false, true),
                ELECTRON_STREAM_HEADER_SETUP_TIMEOUT_MS
            );
            this.cancelPendingApply = cancel;
            void Promise.resolve(ipc).then(
                (acknowledged) =>
                    settle(acknowledged === true, acknowledged !== true),
                () => settle(false, true)
            );
        });
    }

    /**
     * Clears the scoped override — portal credentials must not outlive the
     * playback session that needed them. No-ops when another stream has taken
     * ownership of the slot since, and always in the PWA.
     */
    clear(streamUrl: string | null): void {
        if (
            typeof window.electron?.setUserAgent !== 'function' ||
            streamUrl === null ||
            this.currentScopeUrl !== streamUrl
        ) {
            return;
        }

        this.cancelPendingApply?.();
        this.cancelPendingApply = null;
        this.syncSequence += 1;
        this.currentScopeUrl = null;
        void window.electron
            .setUserAgent(undefined, undefined, streamUrl)
            .catch(() => undefined);
    }
}
