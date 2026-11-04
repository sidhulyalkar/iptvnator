import { Injectable } from '@angular/core';
import type { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';

function getHeaderValue(
    headers: ResolvedPortalPlayback['headers'] | undefined,
    name: string
): string | undefined {
    if (!headers) return undefined;
    const matchingKey = Object.keys(headers).find(
        (key) => key.toLowerCase() === name.toLowerCase()
    );
    return matchingKey ? headers[matchingKey] : undefined;
}

/** IPC setup is independent of media/network/first-frame deadlines. */
export const ELECTRON_STREAM_HEADER_SETUP_TIMEOUT_MS = 15_000;

/**
 * Single renderer owner for all built-in video and audio header handoffs.
 * Main owns the authoritative epoch/generation, not this renderer's timeout.
 * A cancelled or timed-out request is fenced by a newer release generation.
 */
@Injectable({ providedIn: 'root' })
export class ElectronStreamHeadersService {
    private syncSequence = 0;
    private currentScopeUrl: string | null = null;
    private cancelPendingApply: (() => void) | null = null;
    private sessionEpoch: Promise<number> | null = null;

    private epoch(): Promise<number> {
        if (!this.sessionEpoch) {
            // This service is only called when Electron's lease bridge exists.
            const promise = Promise.resolve(
                window.electron!.beginStreamHeaderSession()
            ).then(
                (value) => Number.isSafeInteger(value) && value > 0 ? value : 0,
                () => 0
            );
            this.sessionEpoch = promise;
        }
        return this.sessionEpoch;
    }

    private releaseActive(scopeUrl: string): void {
        if (this.currentScopeUrl !== scopeUrl) return;
        const generation = ++this.syncSequence;
        this.currentScopeUrl = null;
        const bridge = window.electron;
        const epoch = this.sessionEpoch;
        if (!bridge || !epoch) return;
        void epoch.then((value) => {
            if (value <= 0) return false;
            return bridge.releaseStreamHeaders(
                { epoch: value, generation }, scopeUrl
            );
        }).catch(() => undefined);
    }

    /**
     * Returns null only in a PWA. A partially upgraded Electron bridge fails
     * closed (false), never silently starts an authenticated media request.
     */
    apply(playback: ResolvedPortalPlayback): Promise<boolean> | null {
        this.cancelPendingApply?.();
        this.cancelPendingApply = null;

        const bridge = window.electron;
        if (!bridge) return null;
        if (
            typeof bridge.beginStreamHeaderSession !== 'function' ||
            typeof bridge.releaseStreamHeaders !== 'function' ||
            typeof bridge.setUserAgent !== 'function'
        ) return Promise.resolve(false);

        const sequence = ++this.syncSequence;
        const userAgent = playback.userAgent ??
            getHeaderValue(playback.headers, 'User-Agent');
        const referer = playback.referer ??
            getHeaderValue(playback.headers, 'Referer');
        const cookie = getHeaderValue(playback.headers, 'Cookie');
        const authorization = getHeaderValue(playback.headers, 'Authorization');
        this.currentScopeUrl = playback.streamUrl;

        let ipc: Promise<boolean>;
        try {
            ipc = this.epoch().then((epoch) => {
                if (epoch <= 0) return false;
                return bridge.setUserAgent(
                    userAgent, referer, playback.streamUrl,
                    cookie || authorization ? { authorization, cookie } : undefined,
                    { epoch, generation: sequence }
                );
            });
        } catch {
            console.warn('[ElectronStreamHeaders] Request-header setup failed');
            this.releaseActive(playback.streamUrl);
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
                const current = sequence === this.syncSequence;
                if (failed && current) {
                    // Never print an IPC exception: it may contain credentials.
                    console.warn('[ElectronStreamHeaders] Request-header setup failed');
                }
                if (!succeeded && current) this.releaseActive(playback.streamUrl);
                resolve(succeeded && current);
            };
            const cancel = (): void => settle(false);
            const deadline = setTimeout(
                () => settle(false, true),
                ELECTRON_STREAM_HEADER_SETUP_TIMEOUT_MS
            );
            this.cancelPendingApply = cancel;
            void ipc.then(
                (acknowledged) => settle(acknowledged === true, acknowledged !== true),
                () => settle(false, true)
            );
        });
    }

    /** A destroyed/obsolete surface never clears a different active URL. */
    clear(streamUrl: string | null): void {
        if (!streamUrl || this.currentScopeUrl !== streamUrl) return;
        this.cancelPendingApply?.();
        this.cancelPendingApply = null;
        this.releaseActive(streamUrl);
    }
}
