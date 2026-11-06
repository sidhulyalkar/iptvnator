import {
    normalizeSportsDbSchedule,
} from './sportsdb-schedule-normalization.util';
import { selectScheduledSportsEvents } from './sports-event-match.util';

const NOW = Date.parse('2026-11-01T18:30:00Z');
const sample = {
    idEvent: 'fixture-event-01', idLeague: 'nfl-league-fixture',
    strLeague: 'National Football League',
    idHomeTeam: 'gb-fixture', strHomeTeam: 'Green Bay Packers',
    idAwayTeam: 'car-fixture', strAwayTeam: 'Carolina Panthers',
    strTimestamp: '2026-11-01T18:00:00Z',
};

describe('TheSportsDB schedule row normalization', () => {
    it('creates canonical schedule records with explicitly configured aliases', () => {
        const s = normalizeSportsDbSchedule([sample], '2026-11-01T18:15:00Z', {
            leagueAliases: { 'nfl-league-fixture': ['NFL'] },
            teamAliases: {
                'gb-fixture': ['Packers'],
                'car-fixture': ['Panthers'],
            },
        });
        expect(s.providerId).toBe('thesportsdb');
        expect(s.events).toHaveLength(1);
        expect(s.events[0].kickoffUtc).toBe('2026-11-01T18:00:00.000Z');
        expect(selectScheduledSportsEvents(s, 'NFL', NOW)).toHaveLength(1);
        expect(selectScheduledSportsEvents(s, 'Packers vs Panthers', NOW)).toHaveLength(1);
    });

    it('rejects missing timezone, missing team IDs and duplicate events', () => {
        const s = normalizeSportsDbSchedule([
            sample,
            sample,
            { ...sample, idEvent:'no-zone', strTimestamp:'2026-11-01T18:00:00' },
            { ...sample, idEvent:'no-id', idHomeTeam:null },
            { ...sample, idEvent:'same-team', idAwayTeam:'gb-fixture' },
        ], '2026-11-01T18:15:00Z');
        expect(s.events.map(e=>e.id)).toEqual(['fixture-event-01']);
    });

    it('never silently invents an NFL label or channel from provider names', () => {
        const s = normalizeSportsDbSchedule([sample], '2026-11-01T18:15:00Z');
        expect(selectScheduledSportsEvents(s,'NFL',NOW)).toEqual([]);
        expect(s.events[0]).not.toHaveProperty('streamUrl');
        expect(s.events[0]).not.toHaveProperty('channelId');
    });

    it('handles absent rows without implying a full successful source refresh', () => {
        expect(normalizeSportsDbSchedule(null, '2026-11-01T18:15:00Z').events).toEqual([]);
    });
});
