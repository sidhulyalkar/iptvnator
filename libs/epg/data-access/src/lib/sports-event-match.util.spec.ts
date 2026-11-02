import type { ElectronBridgeEpgSearchProgram } from '@iptvnator/shared/interfaces';
import {
    matchScheduledSportsAiring,
    selectScheduledSportsEvents,
    sportsEpgLookupTerm,
    SportsScheduleSnapshot,
} from './sports-event-match.util';

const NOW = Date.parse('2026-11-01T18:30:00Z');
const game = {
    id: 'synthetic-game-1',
    leagueId: 'nfl',
    leagueAliases: ['NFL', 'National Football League', 'football'],
    home: { id: 'gb', name: 'Green Bay Packers', aliases: ['Packers'] },
    away: { id: 'car', name: 'Carolina Panthers', aliases: ['Panthers'] },
    kickoffUtc: '2026-11-01T18:00:00Z',
};
const later = { ...game, id: 'synthetic-game-2', kickoffUtc: '2026-11-08T18:00:00Z' };
const snapshot: SportsScheduleSnapshot = {
    providerId: 'synthetic-schedule',
    fetchedAtUtc: '2026-11-01T18:15:00Z',
    events: [game, later],
};

function programme(title: string, overrides: Partial<ElectronBridgeEpgSearchProgram> = {}):
    ElectronBridgeEpgSearchProgram {
    return {
        title, channel: 'gridiron.example', channelName: 'Gridiron One',
        start: '2026-11-01T18:00:00Z', stop: '2026-11-01T21:00:00Z',
        desc: 'Synthetic fixture', category: 'Sport', ...overrides,
    };
}

describe('sports event schedule and EPG matching', () => {
    it('selects all recent NFL events by league alias without inventing any channel', () => {
        expect(selectScheduledSportsEvents(snapshot, 'NFL', NOW).map((e) => e.id))
            .toEqual(['synthetic-game-1', 'synthetic-game-2']);
        expect(selectScheduledSportsEvents(snapshot, 'football', NOW)).toHaveLength(2);
    });
    it('recognizes both-team queries and team nickname queries', () => {
        expect(selectScheduledSportsEvents(snapshot, 'watch Packers n Panthers game', NOW)).toHaveLength(2);
        expect(selectScheduledSportsEvents(snapshot, 'Packers', NOW)).toHaveLength(2);
        expect(selectScheduledSportsEvents(snapshot, 'Packers vs Eagles', NOW)).toEqual([]);
    });
    it('limits live candidates to recent scheduled kickoffs and upcoming to future', () => {
        expect(selectScheduledSportsEvents(snapshot, 'NFL live', NOW).map((e) => e.id))
            .toEqual(['synthetic-game-1']);
        expect(selectScheduledSportsEvents(snapshot, 'NFL upcoming', NOW).map((e) => e.id))
            .toEqual(['synthetic-game-2']);
    });
    it('rejects stale, future-dated, malformed and unavailable schedule feeds', () => {
        expect(selectScheduledSportsEvents(null, 'NFL', NOW)).toEqual([]);
        expect(selectScheduledSportsEvents({ ...snapshot, fetchedAtUtc: '2026-10-30T00:00:00Z' }, 'NFL', NOW)).toEqual([]);
        expect(selectScheduledSportsEvents({ ...snapshot, fetchedAtUtc: 'wrong' }, 'NFL', NOW)).toEqual([]);
        expect(selectScheduledSportsEvents({ ...snapshot, fetchedAtUtc: '2026-11-02T00:00:00Z' }, 'NFL', NOW)).toEqual([]);
        expect(selectScheduledSportsEvents(snapshot, 'NFL', NaN)).toEqual([]);
        expect(selectScheduledSportsEvents({
            ...snapshot, fetchedAtUtc: '2026-11-01T18:15:00',
        }, 'NFL', NOW)).toEqual([]);
        expect(selectScheduledSportsEvents({
            ...snapshot, events: [{ ...game, kickoffUtc: '2026-11-01T18:00:00' }],
        }, 'NFL', NOW)).toEqual([]);
    });
    it('requires independent home and away team identity and plausible event time', () => {
        expect(selectScheduledSportsEvents({
            ...snapshot, events: [{ ...game, away: game.home }],
        }, 'NFL', NOW)).toEqual([]);
        expect(selectScheduledSportsEvents({
            ...snapshot, events: [{ ...game, kickoffUtc: '2027-01-01T00:00:00Z' }],
        }, 'NFL', NOW)).toEqual([]);
    });
    it('chooses a bounded team alias suitable for substring EPG lookup', () => {
        expect(sportsEpgLookupTerm(game)).toBe('Packers');
        expect(sportsEpgLookupTerm({
            ...game, home: { ...game.home, aliases: [] }, away: { ...game.away, aliases: [] },
        })).toBe('Carolina Panthers');
    });
    it('requires both teams in the title and a close enough kickoff', () => {
        const result = matchScheduledSportsAiring(snapshot, game, [
            programme('Packers vs Panthers'),
            programme('Packers vs Eagles'),
            programme('NFL Sunday'),
            programme('NFL Recap', { desc: 'Packers and Panthers are covered' }),
            programme('Packers vs Panthers', { start: '2026-11-04T18:00:00Z' }),
        ]);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            eventId: 'synthetic-game-1', status: 'epg-candidate',
            evidence: 'both-teams-and-kickoff-window',
        });
    });
    it('preserves independent channel options while deduplicating duplicate guide rows', () => {
        const x = matchScheduledSportsAiring(snapshot, game, [
            programme('Packers vs Panthers'),
            programme('Packers vs Panthers'),
            programme('Packers vs Panthers', { channel: 'alternate.example' }),
        ]);
        expect(x.map((r) => r.programme.channel)).toEqual(['gridiron.example', 'alternate.example']);
        expect(x.every((r) => !('streamUrl' in r) && !('playable' in r))).toBe(true);
    });
    it('respects the optional display-time correction without shifting sports time', () => {
        const result = matchScheduledSportsAiring(snapshot, game, [
            programme('Packers vs Panthers', {
                start: '2026-11-01T17:00:00Z',
                stop: '2026-11-01T20:00:00Z',
            }),
        ], 60);
        expect(result).toHaveLength(1);
    });
    it('does not classify a programme as matching when the airing has ended or has bad dates', () => {
        expect(matchScheduledSportsAiring(snapshot, game, [
            programme('Packers vs Panthers', { stop: '2026-11-01T16:00:00Z' }),
            programme('Packers vs Panthers', { start: 'not a date' }),
        ])).toEqual([]);
    });
});
