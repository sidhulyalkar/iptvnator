import {
    ScopedStreamHeaderLeaseController,
    type ScopedHeaderConfiguration,
} from './scoped-stream-header-lease';

describe('main process scoped stream header leases', () => {
    let applied: ScopedHeaderConfiguration[];
    let clears: number;
    let controller: ScopedStreamHeaderLeaseController;

    beforeEach(() => {
        applied = [];
        clears = 0;
        controller = new ScopedStreamHeaderLeaseController(
            (request) => applied.push(request),
            () => { clears += 1; }
        );
    });

    const request = (id: string): ScopedHeaderConfiguration => ({
        scopeUrl: 'https://cdn.example/live/' + id + '.m3u8',
        credentials: { authorization: 'Bearer PRIVATE' },
    });

    it('rejects delayed A after B and C and keeps C as owner', () => {
        const epoch = controller.begin(7);
        expect(controller.apply(7, { epoch, generation: 2 }, request('B'))).toBe(true);
        expect(controller.apply(7, { epoch, generation: 3 }, request('C'))).toBe(true);
        expect(controller.apply(7, { epoch, generation: 1 }, request('A'))).toBe(false);
        expect(applied.map((x) => x.scopeUrl)).toEqual([
            request('B').scopeUrl, request('C').scopeUrl,
        ]);
        expect(controller.release(7, { epoch, generation: 4 }, request('A').scopeUrl)).toBe(false);
        expect(controller.release(7, { epoch, generation: 4 }, request('C').scopeUrl)).toBe(true);
    });

    it('ignores stale cleanup, including when the same URL is reused', () => {
        const epoch = controller.begin(8);
        controller.apply(8, { epoch, generation: 1 }, request('same'));
        controller.apply(8, { epoch, generation: 3 }, request('same'));
        expect(controller.release(8, { epoch, generation: 2 }, request('same').scopeUrl)).toBe(false);
        expect(controller.release(8, { epoch, generation: 4 }, request('same').scopeUrl)).toBe(true);
        expect(controller.apply(8, { epoch, generation: 1 }, request('same'))).toBe(false);
    });

    it('fences an in-flight setup cancelled before arrival', () => {
        const epoch = controller.begin(6);
        expect(controller.release(6, { epoch, generation: 2 }, request('A').scopeUrl)).toBe(true);
        expect(controller.apply(6, { epoch, generation: 1 }, request('A'))).toBe(false);
        expect(applied).toHaveLength(0);
    });

    it('retires a previous renderer epoch on reload', () => {
        const prior = controller.begin(12);
        controller.apply(12, { epoch: prior, generation: 1 }, request('old'));
        const latest = controller.begin(12);
        expect(latest).toBeGreaterThan(prior);
        expect(controller.apply(12, { epoch: prior, generation: 100 }, request('old'))).toBe(false);
        expect(controller.apply(12, { epoch: latest, generation: 1 }, request('new'))).toBe(true);
        expect(applied.at(-1)?.scopeUrl).toBe(request('new').scopeUrl);
    });

    it('requires the current sender and rejects invalid protocols or generations', () => {
        const epoch = controller.begin(3);
        expect(controller.apply(9, { epoch, generation: 1 }, request('wrong'))).toBe(false);
        expect(controller.apply(3, { epoch, generation: 0 }, request('zero'))).toBe(false);
        expect(controller.apply(3, { epoch, generation: 1 }, {
            scopeUrl: 'file:///private/test', credentials: { cookie: 'secret' },
        })).toBe(false);
        expect(controller.apply(3, { epoch, generation: 1 }, request('good'))).toBe(false);
        expect(controller.apply(3, { epoch, generation: 2 }, request('good'))).toBe(true);
        expect(applied).toHaveLength(1);
    });

    it('invalid new scope retires the previous credentials', () => {
        const epoch = controller.begin(4);
        controller.apply(4, { epoch, generation: 1 }, request('A'));
        const before = clears;
        expect(controller.apply(4, { epoch, generation: 2 }, {
            scopeUrl: 'file:///do-not-load', credentials: { cookie: 'private' },
        })).toBe(false);
        expect(clears).toBeGreaterThan(before);
        expect(controller.release(4, { epoch, generation: 3 }, request('A').scopeUrl)).toBe(true);
        expect(applied).toHaveLength(1);
    });

    it('does not let stale A cleanup acknowledge or supersede C', () => {
        const epoch = controller.begin(5);
        expect(controller.apply(5, { epoch, generation: 1 }, request('A'))).toBe(true);
        expect(controller.apply(5, { epoch, generation: 3 }, request('C'))).toBe(true);
        const before = clears;
        expect(controller.release(5, { epoch, generation: 4 }, request('A').scopeUrl)).toBe(false);
        expect(clears).toBe(before);
        // Rejected release must not consume generation 4.
        expect(controller.release(5, { epoch, generation: 4 }, request('C').scopeUrl)).toBe(true);
        expect(clears).toBe(before + 1);
    });

    it('retires credentials when the owning webContents is destroyed', () => {
        const epoch = controller.begin(22);
        controller.apply(22, { epoch, generation: 1 }, request('A'));
        const before = clears;
        expect(controller.retire(23, epoch)).toBe(false);
        expect(controller.retire(22, epoch - 1)).toBe(false);
        expect(clears).toBe(before);

        expect(controller.retire(22, epoch)).toBe(true);
        expect(controller.hasSession()).toBe(false);
        expect(controller.hasActivatedLeaseProtocol()).toBe(true);
        expect(clears).toBe(before + 1);
        expect(controller.apply(22, { epoch, generation: 99 }, request('A'))).toBe(false);
        expect(controller.retire(22, epoch)).toBe(false);
    });

    it('ignores delayed destruction events from a previous renderer epoch', () => {
        const oldEpoch = controller.begin(11);
        const newEpoch = controller.begin(11);
        expect(controller.apply(11, { epoch: newEpoch, generation: 1 }, request('B'))).toBe(true);
        const before = clears;
        expect(controller.retire(11, oldEpoch)).toBe(false);
        expect(clears).toBe(before);
        expect(controller.release(11, { epoch: newEpoch, generation: 2 }, request('B').scopeUrl)).toBe(true);
    });

    it('fails closed when applying headers throws and does not log secrets', () => {
        const failing = new ScopedStreamHeaderLeaseController(
            () => { throw new Error('private cookie'); },
            () => { clears += 1; }
        );
        const epoch = failing.begin(2);
        expect(failing.apply(2, { epoch, generation: 1 }, request('fail'))).toBe(false);
        expect(clears).toBe(3);
    });
});
