import { inject, Injectable } from '@angular/core';
import { ElectronBridgeEpgSearchProgram } from '@iptvnator/shared/interfaces';
import { EpgRuntimeBridgeService } from './epg-runtime-bridge.service';

const MAX_QUERY_LENGTH = 200;
const MAX_CANDIDATES = 100;
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

        // Only remove clearly spoken commands; "The Game" and "Live"
        // are valid programme titles and must remain searchable.
        let searchTerm = trimmed.replace(
            /^(?:please\s+)?(?:(?:show|find)(?:\s+me)?|watch)\s+/i,
            ''
        );
        let liveOnly = false;
        let upcomingOnly = false;
        // Temporal modifiers are recognized only at phrase boundaries.
        // Consume multiple modifiers to reject contradictory requests.
        for (let i = 0; i < 4; i++) {
            const prefix = searchTerm.match(/^(live|currently|upcoming)\s+/i);
            const suffix = searchTerm.match(/\s+(right now|live|currently|upcoming)$/i);
            const token = prefix?.[1] ?? suffix?.[1];
            if (!token) break;
            if (/^upcoming$/i.test(token)) upcomingOnly = true;
            else liveOnly = true;
            searchTerm = prefix
                ? searchTerm.slice(prefix[0].length)
                : searchTerm.slice(0, -suffix![0].length);
        }
        if (liveOnly && upcomingOnly) return [];

        // A spoken "n" or "versus" between teams is a separator, not
        // a query term. Limit "game" removal to an explicit matchup.
        const matchup = /\s+(?:vs\.?|v\.?|versus|n)\s+/i.test(searchTerm);
        if (matchup) {
            searchTerm = searchTerm.replace(
                /\s+(?:vs\.?|v\.?|versus|n)\s+/gi,
                ' '
            ).replace(/\s+games?$/i, '');
        }
        const cleaned = searchTerm.trim().replace(/\s+/g, ' ');
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
