import {
    EPG_GUIDE_SEARCH_TIMEOUT_MS,
    EpgGuideSearchController,
} from './epg-guide-search.controller';
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
    it('keeps loading distinct from no results and reports valid empty results', async () => {
        const controller = new EpgGuideSearchController(async () => []);
        controller.setQuery('NFL');
        expect(controller.status()).toBe('loading');
        expect(controller.results()).toEqual([]);
        jest.advanceTimersByTime(300);
        await flush();
        expect(controller.status()).toBe('ready');
        expect(controller.panelVisible()).toBe(true);
        controller.destroy();
    });

    it('displays a failure without claiming no matching programmes exist', async () => {
        const controller = new EpgGuideSearchController(async () => {
            throw new Error('Synthetic EPG outage');
        });
        controller.setQuery('NFL');
        jest.advanceTimersByTime(300);
        await flush();
        expect(controller.status()).toBe('error');
        expect(controller.results()).toEqual([]);
        controller.setQuery('');
        expect(controller.status()).toBe('idle');
        expect(controller.panelVisible()).toBe(false);
        controller.destroy();
    });

    it('never exposes results for the previous query during debounce', async () => {
        const controller = new EpgGuideSearchController(async (term) =>
            [hit(term)]
        );
        controller.setQuery('NFL');
        jest.advanceTimersByTime(300);
        await flush();
        expect(controller.results().map((x) => x.program.title)).toEqual(['NFL']);
        controller.setQuery('NBA');
        expect(controller.status()).toBe('loading');
        expect(controller.results()).toEqual([]);
        jest.advanceTimersByTime(300);
        await flush();
        expect(controller.results().map((x) => x.program.title)).toEqual(['NBA']);
        controller.destroy();
    });

    it('does not let an older failure replace a newer success', async () => {
        const resolutions: Array<{
            resolve: (hits: EpgGuideSearchHit[]) => void;
            reject: (error: Error) => void;
        }> = [];
        const controller = new EpgGuideSearchController(
            () => new Promise((resolve, reject) => resolutions.push({
                resolve, reject,
            }))
        );
        controller.setQuery('NFL');
        jest.advanceTimersByTime(300);
        controller.setQuery('NHL');
        jest.advanceTimersByTime(300);
        resolutions[1].resolve([hit('NHL')]);
        await flush();
        resolutions[0].reject(new Error('late failure'));
        await flush();
        expect(controller.status()).toBe('ready');
        expect(controller.results()[0].program.title).toBe('NHL');
        controller.destroy();
    });

    it('fails a stuck provider after its deadline and rejects late results', async () => {
        let resolve!: (hits: EpgGuideSearchHit[]) => void;
        const controller = new EpgGuideSearchController(
            () => new Promise((done) => { resolve = done; })
        );
        controller.setQuery('NFL');
        jest.advanceTimersByTime(300);
        expect(controller.status()).toBe('loading');

        jest.advanceTimersByTime(EPG_GUIDE_SEARCH_TIMEOUT_MS);
        expect(controller.status()).toBe('error');
        expect(controller.results()).toEqual([]);

        resolve([hit('late response')]);
        await flush();
        expect(controller.status()).toBe('error');
        expect(controller.results()).toEqual([]);
        controller.destroy();
    });

    it('recovers on retry after a timeout, without accepting old responses', async () => {
        const resolutions: Array<(hits: EpgGuideSearchHit[]) => void> = [];
        const controller = new EpgGuideSearchController(
            () => new Promise((resolve) => resolutions.push(resolve))
        );
        controller.setQuery('NFL');
        jest.advanceTimersByTime(300 + EPG_GUIDE_SEARCH_TIMEOUT_MS);
        expect(controller.status()).toBe('error');

        controller.setQuery('NFL');
        expect(controller.status()).toBe('loading');
        jest.advanceTimersByTime(300);
        expect(resolutions).toHaveLength(2);
        resolutions[1]([hit('fresh')]);
        await flush();
        expect(controller.status()).toBe('ready');
        expect(controller.results()[0].program.title).toBe('fresh');

        resolutions[0]([hit('old')]);
        await flush();
        jest.advanceTimersByTime(EPG_GUIDE_SEARCH_TIMEOUT_MS);
        expect(controller.status()).toBe('ready');
        expect(controller.results()[0].program.title).toBe('fresh');
        controller.destroy();
    });

    it('cancels the provider deadline when the query is cleared', async () => {
        let resolve!: (hits: EpgGuideSearchHit[]) => void;
        const controller = new EpgGuideSearchController(
            () => new Promise((done) => { resolve = done; })
        );
        controller.setQuery('NFL');
        jest.advanceTimersByTime(300);
        controller.setQuery('');
        jest.advanceTimersByTime(EPG_GUIDE_SEARCH_TIMEOUT_MS);
        expect(controller.status()).toBe('idle');
        resolve([hit('stale')]);
        await flush();
        expect(controller.results()).toEqual([]);
        controller.destroy();
    });

});