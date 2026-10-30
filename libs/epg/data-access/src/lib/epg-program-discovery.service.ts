import { inject, Injectable } from '@angular/core';
import { ElectronBridgeEpgSearchProgram } from '@iptvnator/shared/interfaces';
import { EpgRuntimeBridgeService } from './epg-runtime-bridge.service';

const MAX_QUERY_LENGTH = 200;
const MAX_CANDIDATES = 100;
const STOP_WORDS = new Set([
    'watch', 'find', 'show', 'me', 'the', 'a', 'an', 'game', 'games',
    'please', 'right', 'now', 'live', 'currently', 'upcoming',
]);
const MATCHUP_CONNECTORS = new Set(['vs', 'v', 'versus', 'n']);

export interface EpgDiscoverySearchOptions {
    /** Provider-clock milliseconds, not display-clock milliseconds. */
    nowMs?: number;
}

/**
 * Read-only adapter over the existing indexed EPG bridge. This does not
 * resolve playback, identify a licensed broadcaster, or synthesize schedules.
 * A hit is programme metadata; only the owning guide can bind it to a row.
 */
@Injectable({ providedIn: 'root' })
export class EpgProgramDiscoveryService {
    private readonly epg = inject(EpgRuntimeBridgeService);

    async search(
        query: string,
        limit = 20,
        options: EpgDiscoverySearchOptions = {}
    ): Promise<ElectronBridgeEpgSearchProgram[]> {
        const trimmed = query.trim();
        if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) return [];

        const tokens = trimmed.split(/\s+/);
        const liveOnly = tokens.some((part) =>
            /^(?:now|live|currently)$/i.test(part)
        );
        const upcomingOnly = tokens.some((part) =>
            /^upcoming$/i.test(part)
        );
        if (liveOnly && upcomingOnly) return [];

        const cleaned = tokens
            .map((part) => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
            .filter((part) => {
                const lower = part.toLowerCase();
                return (
                    !STOP_WORDS.has(lower) &&
                    !MATCHUP_CONNECTORS.has(lower)
                );
            })
            .join(' ')
            .trim();
        if (!cleaned) return [];

        const constrained = liveOnly || upcomingOnly;
        const resultLimit = Number.isInteger(limit)
            ? Math.max(1, Math.min(limit, 50))
            : 20;
        const candidateLimit = constrained ? MAX_CANDIDATES : resultLimit;
        const results = (await this.epg.searchPrograms(
            cleaned === trimmed ? trimmed : cleaned,
            candidateLimit
        )) ?? [];

        if (!constrained) return results.slice(0, resultLimit);
        const nowMs = options.nowMs ?? Date.now();
        if (!Number.isFinite(nowMs)) return [];

        // The EPG may be stale or timestamps malformed. Never call such a row
        // "live" solely because its title mentions an event.
        return results
            .filter((program) => {
                const start = Date.parse(program.start);
                const stop = Date.parse(program.stop);
                if (!Number.isFinite(start) || !Number.isFinite(stop) || start >= stop)
                    return false;
                return liveOnly
                    ? start <= nowMs && nowMs < stop
                    : start > nowMs;
            })
            .slice(0, resultLimit);
    }
}
