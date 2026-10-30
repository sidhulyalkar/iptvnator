import { TestBed } from '@angular/core/testing';
import { EpgRuntimeBridgeService } from './epg-runtime-bridge.service';
import { EpgProgramDiscoveryService } from './epg-program-discovery.service';
import { SPORTS_SCHEDULE_SOURCE } from './sports-schedule-source';

const NOW = Date.parse('2026-11-01T18:30:00Z');
const snapshot = {
    providerId: 'synthetic',
    fetchedAtUtc: '2026-11-01T18:15:00Z',
    events: [{
        id: 'fixture-nfl-1',
        leagueId: 'nfl',
        leagueAliases: ['NFL', 'football'],
        home: { id: 'gb', name: 'Green Bay Packers', aliases: ['Packers'] },
        away: { id: 'car', name: 'Carolina Panthers', aliases: ['Panthers'] },
        kickoffUtc: '2026-11-01T18:00:00Z',
    }],
};
const makeProgram = (
    title: string,
    start = '2026-11-01T18:00:00Z',
    stop = '2026-11-01T21:00:00Z'
) => ({
    title, start, stop, channel: 'gridiron.example', channelName: 'Gridiron One',
    desc: 'Synthetic fixture', category: 'Sport',
});

describe('EpgProgramDiscoveryService', () => {
    const searchPrograms = jest.fn();
    const loadSchedule = jest.fn();
    let discovery: EpgProgramDiscoveryService;

    beforeEach(() => {
        searchPrograms.mockReset().mockResolvedValue([]);
        loadSchedule.mockReset().mockResolvedValue(null);
        TestBed.configureTestingModule({
            providers: [
                EpgProgramDiscoveryService,
                { provide: EpgRuntimeBridgeService, useValue: { searchPrograms } },
                { provide: SPORTS_SCHEDULE_SOURCE, useValue: { loadSchedule } },
            ],
        });
        discovery = TestBed.inject(EpgProgramDiscoveryService);
    });
    afterEach(() => TestBed.resetTestingModule());

    it('passes ordinary titles through the legacy bridge unchanged', async () => {
        const rows = [makeProgram('The Game')];
        searchPrograms.mockResolvedValue(rows);
        expect(await discovery.search('The Game')).toEqual(rows);
        expect(searchPrograms).toHaveBeenCalledWith('The Game', 20);
        expect(await discovery.search('Live')).toEqual(rows);
        expect(searchPrograms).toHaveBeenLastCalledWith('Live', 20);
    });

    it('finds a real guide title for spoken matchup words despite legacy SQL LIKE', async () => {
        const rows = [makeProgram('Packers vs Panthers')];
        searchPrograms.mockResolvedValue(rows);
        expect(await discovery.search('watch Packers n Panthers game')).toEqual(rows);
        expect(searchPrograms).toHaveBeenLastCalledWith('Packers', 100);
    });

    it('rejects false matchups rather than treating one team as enough', async () => {
        searchPrograms.mockResolvedValue([
            makeProgram('Packers vs Panthers'),
            makeProgram('Packers weekly news'),
        ]);
        expect(await discovery.search('Packers vs Eagles')).toEqual([]);
        expect(searchPrograms).toHaveBeenLastCalledWith('Packers', 100);
    });

    it('maps a verified synthetic schedule league to title-only guide programmes', async () => {
        loadSchedule.mockResolvedValue(snapshot);
        searchPrograms.mockResolvedValue([
            makeProgram('Packers vs Panthers'),
            makeProgram('Packers vs Eagles'),
        ]);
        const out = await discovery.search('NFL live', 20, {
            nowMs: NOW, nowUtcMs: NOW, epgOffsetMinutes: 0,
        });
        expect(out.map(p => p.title)).toEqual(['Packers vs Panthers']);
        expect(loadSchedule).toHaveBeenCalledTimes(1);
        expect(searchPrograms).toHaveBeenLastCalledWith('Packers', 100);
    });

    it('corrects EPG provider time separately from actual sports kickoff', async () => {
        loadSchedule.mockResolvedValue(snapshot);
        searchPrograms.mockResolvedValue([
            makeProgram('Packers vs Panthers',
                '2026-11-01T17:00:00Z', '2026-11-01T20:00:00Z'),
        ]);
        const out = await discovery.search('NFL live', 20, {
            nowUtcMs: NOW, nowMs: NOW - 60 * 60 * 1000,
            epgOffsetMinutes: 60,
        });
        expect(out).toHaveLength(1);
        expect(out[0].title).toBe('Packers vs Panthers');
    });

    it('falls back to EPG search when optional schedule data is unavailable', async () => {
        loadSchedule.mockRejectedValue(new Error('Synthetic provider offline'));
        searchPrograms.mockResolvedValue([makeProgram('NFL Nightly')]);
        await expect(discovery.search('NFL')).resolves.toEqual([makeProgram('NFL Nightly')]);
        expect(searchPrograms).toHaveBeenCalledWith('NFL', 20);
    });

    it('never labels an EPG metadata hit as playable or resolves video', async () => {
        loadSchedule.mockResolvedValue(snapshot);
        searchPrograms.mockResolvedValue([makeProgram('Packers vs Panthers')]);
        const result = await discovery.search('NFL', 20, {
            nowUtcMs: NOW, nowMs: NOW,
        });
        expect(result).toHaveLength(1);
        expect(JSON.stringify(result)).not.toMatch(/streamUrl|isPlayable|playbackStatus/);
    });

    it('does not use a stale schedule to invent a new game', async () => {
        loadSchedule.mockResolvedValue({
            ...snapshot, fetchedAtUtc: '2026-10-30T18:00:00Z',
        });
        searchPrograms.mockResolvedValue([]);
        await expect(discovery.search('NFL', 20, {
            nowUtcMs: NOW, nowMs: NOW,
        })).resolves.toEqual([]);
        expect(searchPrograms).toHaveBeenCalledWith('NFL', 20);
    });

    it('filters live and upcoming by the raw EPG provider-clock boundaries', async () => {
        searchPrograms.mockResolvedValue([
            makeProgram('NFL', '2026-11-01T18:00:00Z','2026-11-01T21:00:00Z'),
            makeProgram('NFL', '2026-11-08T18:00:00Z','2026-11-08T21:00:00Z'),
            makeProgram('NFL', 'bad', '2026-11-01T21:00:00Z'),
        ]);
        expect(await discovery.search('NFL live', 20, {
            nowMs:NOW, nowUtcMs:NOW,
        })).toHaveLength(1);
        expect(await discovery.search('NFL upcoming', 20, {
            nowMs:NOW, nowUtcMs:NOW,
        })).toHaveLength(1);
        expect(await discovery.search('NFL live', 20, {
            nowMs:Date.parse('2026-11-01T21:00:00Z'),
            nowUtcMs:NOW,
        })).toHaveLength(0);
    });

    it('bounds input and rejects contradictory live/upcoming modifiers', async () => {
        expect(await discovery.search('x'.repeat(201))).toEqual([]);
        expect(await discovery.search('NFL live upcoming')).toEqual([]);
        expect(await discovery.search('')).toEqual([]);
        expect(searchPrograms).not.toHaveBeenCalled();
    });
});
