import { EpgGuideSearchController } from './epg-guide-search.controller';
import { EpgGuideSearchHit } from './epg-guide-source';

const hit = (title: string): EpgGuideSearchHit => ({
    channelId: null,
    program: {
        channel: 'test',
        title,
        start: '2026-11-01T18:00:00Z',
        stop: '2026-11-01T19:00:00Z',
        desc: null,
        category: null,
    },
});
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('EpgGuideSearchController request ownership', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('rejects an old response when the same query is entered again', async () => {
        const resolutions: Array<(hits: EpgGuideSearchHit[]) => void> = [];
        const controller = new EpgGuideSearchController(
            () => new Promise((resolve) => resolutions.push(resolve))
        );
        controller.setQuery('NFL');
        jest.advanceTimersByTime(300);
        controller.setQuery('NBA');
        controller.setQuery('NFL');
        jest.advanceTimersByTime(300);
        expect(resolutions).toHaveLength(2);

        resolutions[1]([hit('new')]);
        await flush();
        expect(controller.results().map((x) => x.program.title)).toEqual(['new']);
        resolutions[0]([hit('old')]);
        await flush();
        expect(controller.results().map((x) => x.program.title)).toEqual(['new']);
        controller.destroy();
    });

    it('does not publish a response after clearing the field', async () => {
        let resolve!: (hits: EpgGuideSearchHit[]) => void;
        const controller = new EpgGuideSearchController(
            () => new Promise((done) => { resolve = done; })
        );
        controller.setQuery('news');
        jest.advanceTimersByTime(300);
        controller.setQuery('');
        resolve([hit('stale')]);
        await flush();
        expect(controller.results()).toEqual([]);
        expect(controller.panelVisible()).toBe(false);
        controller.destroy();
    });

    it('does not publish after destruction', async () => {
        let resolve!: (hits: EpgGuideSearchHit[]) => void;
        const controller = new EpgGuideSearchController(
            () => new Promise((done) => { resolve = done; })
        );
        controller.setQuery('NFL');
        jest.advanceTimersByTime(300);
        controller.destroy();
        resolve([hit('late')]);
        await flush();
        expect(controller.results()).toEqual([]);
        controller.setQuery('news');
        jest.advanceTimersByTime(300);
        expect(controller.results()).toEqual([]);
    });
});
