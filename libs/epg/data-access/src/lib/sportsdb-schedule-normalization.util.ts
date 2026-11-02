import type {
    ScheduledSportsEvent,
    SportsScheduleSnapshot,
} from './sports-event-match.util';

/** TheSportsDB v1 event subset. Unknown fields are ignored. */
export interface SportsDbEventRow {
    idEvent?: string | null;
    idLeague?: string | null;
    strLeague?: string | null;
    idHomeTeam?: string | null;
    strHomeTeam?: string | null;
    idAwayTeam?: string | null;
    strAwayTeam?: string | null;
    strTimestamp?: string | null;
}

export interface SportsDbAliasMapping {
    /** Explicit, audited provider league IDs (e.g. NFL alias). */
    leagueAliases?: Readonly<Record<string, readonly string[]>>;
    /** External provider team IDs, not names, to avoid cross-league collisions. */
    teamAliases?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Deterministic adapter only. No networking, scraping or automatic mapping
 * of provider channels. A provider adapter must fetch and cache authorized
 * data separately, then pass that data to this function.
 */
export function normalizeSportsDbSchedule(
    rows: readonly SportsDbEventRow[] | null | undefined,
    fetchedAtUtc: string,
    aliases: SportsDbAliasMapping = {}
): SportsScheduleSnapshot {
    const events: ScheduledSportsEvent[] = [];
    const seen = new Set<string>();
    for (const row of (Array.isArray(rows) ? rows : []).slice(0, 1000)) {
        const id = row?.idEvent?.trim();
        const leagueId = row?.idLeague?.trim();
        const homeId = row?.idHomeTeam?.trim();
        const awayId = row?.idAwayTeam?.trim();
        const home = row?.strHomeTeam?.trim();
        const away = row?.strAwayTeam?.trim();
        const utc = row?.strTimestamp?.trim();
        // Reject timestamps lacking explicit timezone: guessing local time
        // would produce false live broadcasts across DST boundaries.
        if (!id || !leagueId || !homeId || !awayId || homeId === awayId ||
            !home || !away || !utc ||
            !/(?:Z|[+-]\d{2}:\d{2})$/i.test(utc) ||
            !Number.isFinite(Date.parse(utc)) || seen.has(id)) continue;
        seen.add(id);
        const leagueNames = [
            row.strLeague ?? '', ...(aliases.leagueAliases?.[leagueId] ?? []),
        ].map(x => x.trim()).filter(Boolean);
        events.push({
            id,
            leagueId,
            leagueAliases: [...new Set(leagueNames)],
            home: {
                id: homeId,
                name: home,
                aliases: [...(aliases.teamAliases?.[homeId] ?? [])],
            },
            away: {
                id: awayId,
                name: away,
                aliases: [...(aliases.teamAliases?.[awayId] ?? [])],
            },
            kickoffUtc: new Date(utc).toISOString(),
        });
    }
    return {
        providerId: 'thesportsdb',
        fetchedAtUtc,
        events,
    };
}
