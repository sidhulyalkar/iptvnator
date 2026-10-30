import { epgOffsetMs, type ElectronBridgeEpgSearchProgram } from '@iptvnator/shared/interfaces';

/** Identity belongs to the schedule provider; IPTV channel identity is separate. */
export interface ScheduledSportsTeam {
    id: string;
    name: string;
    aliases: readonly string[];
}

export interface ScheduledSportsEvent {
    id: string;
    leagueId: string;
    leagueAliases: readonly string[];
    home: ScheduledSportsTeam;
    away: ScheduledSportsTeam;
    /** ISO-8601 instant including Z or a numeric UTC offset. */
    kickoffUtc: string;
}

export interface SportsScheduleSnapshot {
    providerId: string;
    fetchedAtUtc: string;
    events: readonly ScheduledSportsEvent[];
}

export interface MatchedSportsAiring {
    eventId: string;
    providerId: string;
    programme: ElectronBridgeEpgSearchProgram;
    status: 'epg-candidate';
    evidence: 'both-teams-and-kickoff-window';
}

const MAX_SNAPSHOT_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_EVENTS_PER_QUERY = 6;
const MAX_START_OFFSET_MS = 2 * 60 * 60 * 1000;
const MAX_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const MAX_LOOKAHEAD_MS = 14 * 24 * 60 * 60 * 1000;

function normalize(input: string): string {
    return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim().replace(/\s+/g, ' ');
}

function containsPhrase(haystack: string, phrase: string): boolean {
    const needle = normalize(phrase);
    if (!needle) return false;
    return (' ' + normalize(haystack) + ' ').includes(' ' + needle + ' ');
}

function teamAliases(team: ScheduledSportsTeam): string[] {
    return [team.name, ...team.aliases].filter(
        (a) => a.trim().length >= 3
    );
}

function queryTerms(query: string): string {
    return normalize(query
        .replace(/^(?:please\s+)?(?:(?:find|show)(?:\s+me)?|watch)\s+/i, '')
        .replace(/\s+(?:game|match)\s*$/i, '')
        .replace(/\s+(?:right now|live|currently|upcoming)\s*$/i, ''));
}

/** A stale/partial/implausible feed must never generate a live-channel claim. */
export function selectScheduledSportsEvents(
    snapshot: SportsScheduleSnapshot | null,
    query: string,
    nowMs: number
): ScheduledSportsEvent[] {
    if (!snapshot || !Number.isFinite(nowMs) || !snapshot.providerId) return [];
    const fetched = Date.parse(snapshot.fetchedAtUtc);
    if (!Number.isFinite(fetched) || nowMs - fetched > MAX_SNAPSHOT_AGE_MS ||
        fetched - nowMs > 5 * 60 * 1000 || !Array.isArray(snapshot.events)) return [];
    const q = queryTerms(query);
    if (!q) return [];
    const wantsLive = /\b(?:live|currently|right now)\s*$/i.test(query);
    const wantsUpcoming = /\bupcoming\s*$/i.test(query);
    const selected: ScheduledSportsEvent[] = [];
    for (const event of snapshot.events.slice(0, 500)) {
        if (!event?.id || !event.leagueId || event.home?.id === event.away?.id ||
            !event.home?.id || !event.away?.id) continue;
        const kickoff = Date.parse(event.kickoffUtc);
        if (!Number.isFinite(kickoff) ||
            kickoff < nowMs - MAX_LOOKBACK_MS ||
            kickoff > nowMs + MAX_LOOKAHEAD_MS) continue;
        if (wantsUpcoming && kickoff <= nowMs) continue;
        // A schedule does not provide a trustworthy live stream status.
        // Query "live" can only nominate recent events for EPG verification.
        if (wantsLive && (kickoff > nowMs || kickoff < nowMs - MAX_LOOKBACK_MS)) continue;
        const league = event.leagueAliases.some((alias) => normalize(alias) === q);
        const home = teamAliases(event.home).some((alias) => containsPhrase(q, alias));
        const away = teamAliases(event.away).some((alias) => containsPhrase(q, alias));
        const singleTeam = (home || away) &&
            (teamAliases(event.home).some((alias) => normalize(alias) === q) ||
             teamAliases(event.away).some((alias) => normalize(alias) === q));
        if (league || (home && away) || singleTeam) selected.push(event);
    }
    return selected.sort((a, b) =>
        Math.abs(Date.parse(a.kickoffUtc) - nowMs) -
        Math.abs(Date.parse(b.kickoffUtc) - nowMs) ||
        a.id.localeCompare(b.id)
    ).slice(0, MAX_EVENTS_PER_QUERY);
}

/** Query the existing EPG title/description index with one team nickname. */
export function sportsEpgLookupTerm(event: ScheduledSportsEvent): string | null {
    const choices = [...teamAliases(event.away), ...teamAliases(event.home)]
        .map((name) => name.trim())
        .filter((name) => name.length >= 4 && name.length <= 48);
    // A single surname tends to be more robust than the full team name
    // against broadcast listings ("Packers vs Panthers" vs full club names).
    choices.sort((a, b) => a.length - b.length || a.localeCompare(b));
    return choices[0] ?? null;
}

export function matchScheduledSportsAiring(
    snapshot: SportsScheduleSnapshot,
    event: ScheduledSportsEvent,
    candidates: readonly ElectronBridgeEpgSearchProgram[],
    epgOffsetMinutes = 0
): MatchedSportsAiring[] {
    const kickoff = Date.parse(event.kickoffUtc);
    if (!Number.isFinite(kickoff)) return [];
    const correctionMs = epgOffsetMs(epgOffsetMinutes);
    const found: MatchedSportsAiring[] = [];
    const dedupe = new Set<string>();
    for (const programme of candidates) {
        if (!programme || typeof programme.title !== 'string' ||
            typeof programme.channel !== 'string') continue;
        const start = Date.parse(programme.start) + correctionMs;
        const stop = Date.parse(programme.stop) + correctionMs;
        if (!Number.isFinite(start) || !Number.isFinite(stop) || start >= stop ||
            Math.abs(start - kickoff) > MAX_START_OFFSET_MS ||
            stop < kickoff - 30 * 60 * 1000) continue;
        // Require both teams in the programme's TITLE. Generic "NFL" rows
        // and descriptions mentioning multiple games are not enough.
        const home = teamAliases(event.home).some((a) => containsPhrase(programme.title, a));
        const away = teamAliases(event.away).some((a) => containsPhrase(programme.title, a));
        if (!home || !away) continue;
        const key = JSON.stringify([programme.channel, programme.start, programme.title]);
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        found.push({
            providerId: snapshot.providerId,
            eventId: event.id,
            programme,
            status: 'epg-candidate',
            evidence: 'both-teams-and-kickoff-window',
        });
    }
    return found;
}
