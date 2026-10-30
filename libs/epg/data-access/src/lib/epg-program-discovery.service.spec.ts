import { TestBed } from '@angular/core/testing';
import { EpgRuntimeBridgeService } from './epg-runtime-bridge.service';
import { EpgProgramDiscoveryService } from './epg-program-discovery.service';

const makeProgram = (
    title: string,
    start = '2026-11-01T18:00:00Z',
    stop = '2026-11-01T21:00:00Z'
) => ({
    title, start, stop, channel: 'gridiron.example', channelName: 'Gridiron One',
    desc: 'Synthetic NFL match', category: 'Sport',
});

describe('EpgProgramDiscoveryService', () => {
    const searchPrograms = jest.fn();
    let discovery: EpgProgramDiscoveryService;

    beforeEach(() => {
        searchPrograms.mockReset();
        searchPrograms.mockResolvedValue([]);
        TestBed.configureTestingModule({
            providers: [
                EpgProgramDiscoveryService,
                {
                    provide: EpgRuntimeBridgeService,
                    useValue: { searchPrograms },
                },
            ],
        });
        discovery = TestBed.inject(EpgProgramDiscoveryService);
    });

    afterEach(() => TestBed.resetTestingModule());

    it('preserves plain guide-search behavior and the requested limit', async () => {
        searchPrograms.mockResolvedValue([makeProgram('News at Six')]);
        expect(await discovery.search('news', 20)).toHaveLength(1);
        expect(searchPrograms).toHaveBeenCalledWith('news', 20);
    });

    it('normalizes matchup phrases without inventing a broadcast', async () => {
        const result = [makeProgram('Packers vs Panthers')];
        searchPrograms.mockResolvedValue(result);
        expect(await discovery.search('watch Packers n Panthers game')).toEqual(result);
        expect(searchPrograms).toHaveBeenCalledWith('Packers Panthers', 20);
        searchPrograms.mockResolvedValue([]);
        await expect(discovery.search('Packers vs Eagles')).resolves.toEqual([]);
        expect(searchPrograms).toHaveBeenLastCalledWith('Packers Eagles', 20);
    });

    it('filters live sports by provider-clock interval, including stop boundary', async () => {
        searchPrograms.mockResolvedValue([
            makeProgram('Packers vs Panthers'),
            makeProgram('Past Game', '2026-10-31T18:00:00Z', '2026-10-31T21:00:00Z'),
            makeProgram('Bad EPG', 'wrong', '2026-11-01T21:00:00Z'),
        ]);
        expect(
            await discovery.search('NFL right now', 20, {
                nowMs: Date.parse('2026-11-01T18:30:00Z'),
            })
        ).toEqual([makeProgram('Packers vs Panthers')]);
        expect(searchPrograms).toHaveBeenCalledWith('NFL', 100);
        expect(
            await discovery.search('NFL live', 20, {
                nowMs: Date.parse('2026-11-01T21:00:00Z'),
            })
        ).toEqual([]);
    });

    it('can request upcoming programmes without treating ended games as upcoming', async () => {
        const next = makeProgram('Future', '2026-11-08T18:00:00Z', '2026-11-08T21:00:00Z');
        searchPrograms.mockResolvedValue([makeProgram('Now'), next]);
        expect(await discovery.search('NFL upcoming', 20, {
            nowMs: Date.parse('2026-11-01T18:30:00Z'),
        })).toEqual([next]);
    });

    it('retains independent EPG rows even when programme titles match', async () => {
        const same = makeProgram('Match');
        searchPrograms.mockResolvedValue([same, { ...same, channel: 'alternate.tv' }]);
        expect(await discovery.search('Match')).toHaveLength(2);
    });

    it('handles absent capability and malformed or conflicting queries safely', async () => {
        searchPrograms.mockResolvedValue(null);
        expect(await discovery.search('news')).toEqual([]);
        expect(await discovery.search('live upcoming NFL')).toEqual([]);
        expect(await discovery.search('x'.repeat(201))).toEqual([]);
        expect(await discovery.search('')).toEqual([]);
        expect(searchPrograms).toHaveBeenCalledTimes(1);
    });

    it('preserves legitimate titles that contain conversational words', async () => {
        const titles = [makeProgram('The Game'), makeProgram('Live')];
        searchPrograms.mockResolvedValue(titles);
        expect(await discovery.search('The Game')).toEqual(titles);
        expect(searchPrograms).toHaveBeenLastCalledWith('The Game', 20);
        expect(await discovery.search('Live')).toEqual(titles);
        expect(searchPrograms).toHaveBeenLastCalledWith('Live', 20);
    });

    it('does not open video, request channel links, or attach playback claims', async () => {
        const rows = [makeProgram('Packers vs Panthers')];
        searchPrograms.mockResolvedValue(rows);
        const result = await discovery.search('Packers Panthers');
        expect(result).toEqual(rows);
        expect(JSON.stringify(result)).not.toMatch(/streamUrl|playbackStatus|isPlayable/);
    });
});
