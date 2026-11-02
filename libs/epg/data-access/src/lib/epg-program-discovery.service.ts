import { inject, Injectable } from '@angular/core';
import { ElectronBridgeEpgSearchProgram } from '@iptvnator/shared/interfaces';
import { EpgRuntimeBridgeService } from './epg-runtime-bridge.service';
import {
    matchScheduledSportsAiring,
    selectScheduledSportsEvents,
    sportsEpgLookupTerm,
} from './sports-event-match.util';
import { SPORTS_SCHEDULE_SOURCE } from './sports-schedule-source';

const MAX_QUERY_LENGTH = 200;
const MAX_CANDIDATES = 100;

export interface EpgDiscoverySearchOptions {
    /** Provider-clock milliseconds, for uncorrected EPG intervals. */
    nowMs?: number;
    /** Actual UTC clock; sports schedules always use real instants. */
    nowUtcMs?: number;
    /** User's EPG display correction, not a correction to the sports feed. */
    epgOffsetMinutes?: number;
}

function containsTitlePhrase(title: string, phrase: string): boolean {
    const normalized = (value: string) =>
        value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const needle = normalized(phrase);
    return needle.length > 0 &&
        (' ' + normalized(title) + ' ').includes(' ' + needle + ' ');
}

function uniquePrograms(
    rows: readonly ElectronBridgeEpgSearchProgram[],
    limit: number
): ElectronBridgeEpgSearchProgram[] {
    const seen = new Set<string>();
    return rows.filter((p) => {
        const key = JSON.stringify([p.channel, p.start, p.title]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, limit);
}

@Injectable({ providedIn: 'root' })
export class EpgProgramDiscoveryService {
    private readonly epg = inject(EpgRuntimeBridgeService);
    /** No network or sports-provider access unless the application opts in. */
    private readonly schedule = inject(SPORTS_SCHEDULE_SOURCE, {
        optional: true,
    });

    async search(
        query: string,
        limit = 20,
        options: EpgDiscoverySearchOptions = {}
    ): Promise<ElectronBridgeEpgSearchProgram[]> {
        const trimmed = query.trim();
        if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) return [];
        let phrase = trimmed.replace(
            /^(?:please\s+)?(?:(?:show|find)(?:\s+me)?|watch)\s+/i,
            ''
        );
        let liveOnly = false;
        let upcomingOnly = false;
        for (let i = 0; i < 4; i++) {
            const prefix = phrase.match(/^(live|currently|upcoming)\s+/i);
            const suffix = phrase.match(/\s+(right now|live|currently|upcoming)$/i);
            const token = prefix?.[1] ?? suffix?.[1];
            if (!token) break;
            if (/^upcoming$/i.test(token)) upcomingOnly = true;
            else liveOnly = true;
            phrase = prefix ? phrase.slice(prefix[0].length) :
                phrase.slice(0, -suffix![0].length);
        }
        if (liveOnly && upcomingOnly) return [];

        const withoutGame = phrase.replace(/\s+games?$/i, '');
        const matchup = withoutGame.match(
            /^(.{2,60}?)\s+(?:vs\.?|v\.?|versus|n)\s+(.{2,60}?)$/i
        );
        // A literal title "The Game" and any non-matchup phrase retain
        // their complete wording.
        const cleaned = (matchup
            ? matchup[1] + ' ' + matchup[2]
            : phrase).trim().replace(/\s+/g, ' ');
        if (!cleaned) return [];

        const resultLimit = Number.isInteger(limit)
            ? Math.max(1, Math.min(limit, 50))
            : 20;
        const candidateLimit = liveOnly || upcomingOnly
            ? MAX_CANDIDATES : resultLimit;
        const nowMs = options.nowMs ?? Date.now();
        const nowUtcMs = options.nowUtcMs ?? Date.now();
        if (!Number.isFinite(nowMs) || !Number.isFinite(nowUtcMs)) return [];

        // An explicit, recent schedule may connect "NFL" to guide titles
        // without that league word. A schedule alone cannot open a channel.
        if (this.schedule &&
            (matchup || /\b(?:nfl|nba|nhl|mlb|soccer|football|game|match)\b/i.test(trimmed))) {
            const scheduled = await this.searchScheduled(
                trimmed, resultLimit, options, nowUtcMs
            );
            if (scheduled.length) return this.filterByTime(
                scheduled, liveOnly, upcomingOnly, nowMs, resultLimit
            );
        }

        // The current EPG SQL search uses LIKE %entire query%, not
        // token-level FTS. Search one matchup side, then strictly check
        // that BOTH team names occur in the title. This avoids silently
        // missing "Packers vs Panthers" after a spoken "Packers n Panthers".
        if (matchup) {
            const candidates = (await this.epg.searchPrograms(
                matchup[1].trim(), MAX_CANDIDATES
            )) ?? [];
            const matched = candidates.filter((p) =>
                containsTitlePhrase(p.title, matchup[1]) &&
                containsTitlePhrase(p.title, matchup[2])
            );
            return this.filterByTime(
                uniquePrograms(matched, MAX_CANDIDATES),
                liveOnly, upcomingOnly, nowMs, resultLimit
            );
        }

        const results = (await this.epg.searchPrograms(
            cleaned === trimmed ? trimmed : cleaned,
            candidateLimit
        )) ?? [];
        return this.filterByTime(results, liveOnly, upcomingOnly, nowMs, resultLimit);
    }

    private async searchScheduled(
        query: string,
        limit: number,
        options: EpgDiscoverySearchOptions,
        nowUtcMs: number
    ): Promise<ElectronBridgeEpgSearchProgram[]> {
        if (!this.schedule) return [];
        try {
            const snapshot = await this.schedule.loadSchedule();
            const events = selectScheduledSportsEvents(snapshot, query, nowUtcMs);
            if (!snapshot || !events.length) return [];
            const results: ElectronBridgeEpgSearchProgram[] = [];
            // Maximum six indexed lookups, each bounded to 100 candidates.
            // No provider stream is contacted or prebuffered.
            for (const event of events) {
                const term = sportsEpgLookupTerm(event);
                if (!term) continue;
                const candidates = (await this.epg.searchPrograms(
                    term, MAX_CANDIDATES
                )) ?? [];
                const matched = matchScheduledSportsAiring(
                    snapshot, event, candidates, options.epgOffsetMinutes ?? 0
                );
                for (const match of matched) results.push(match.programme);
                if (results.length >= limit) break;
            }
            return uniquePrograms(results, limit);
        } catch {
            // A missing/errored optional schedule must not break EPG search.
            return [];
        }
    }

    private filterByTime(
        programs: readonly ElectronBridgeEpgSearchProgram[],
        liveOnly: boolean,
        upcomingOnly: boolean,
        nowMs: number,
        limit: number
    ): ElectronBridgeEpgSearchProgram[] {
        if (!liveOnly && !upcomingOnly) return programs.slice(0, limit);
        return programs.filter((program) => {
            const start = Date.parse(program.start);
            const stop = Date.parse(program.stop);
            if (!Number.isFinite(start) || !Number.isFinite(stop) || start >= stop)
                return false;
            return liveOnly
                ? start <= nowMs && nowMs < stop
                : start > nowMs;
        }).slice(0, limit);
    }
}
