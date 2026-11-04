import { EventEmitter } from 'events';

type FakeSender = EventEmitter & {
    id: number;
    isDestroyed: jest.Mock<boolean, []>;
};
type Handler = (event: { sender: FakeSender }, ...args: unknown[]) => unknown;

const mockHandlers = new Map<string, Handler>();
const mockConfigure = jest.fn();
const mockClearScoped = jest.fn();

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn((name: string, handler: Handler) => {
            mockHandlers.set(name, handler);
        }),
    },
}));

jest.mock('../services/request-header-overrides.service', () => ({
    configureRequestHeaderOverride: (...args: unknown[]) =>
        mockConfigure(...args),
    clearScopedRequestHeaderOverride: () => mockClearScoped(),
}));

const STREAM_A = 'https://cdn.example/live/a.m3u8';
const STREAM_C = 'https://cdn.example/live/c.m3u8';

function sender(id = 101): FakeSender {
    return Object.assign(new EventEmitter(), {
        id,
        isDestroyed: jest.fn(() => false),
    });
}

function invoke(
    channel: string,
    owner: FakeSender,
    ...args: unknown[]
): unknown {
    const handler = mockHandlers.get(channel);
    if (!handler) throw new Error('Missing IPC handler: ' + channel);
    return handler({ sender: owner }, ...args);
}

describe('stream-header IPC lifecycle', () => {
    beforeAll(async () => {
        await import('./shared.events');
    });

    beforeEach(() => {
        mockConfigure.mockClear();
        mockClearScoped.mockClear();
    });

    it('registers all required header IPC channels', () => {
        expect(mockHandlers.has('begin-stream-header-session')).toBe(true);
        expect(mockHandlers.has('set-user-agent')).toBe(true);
        expect(mockHandlers.has('release-stream-headers')).toBe(true);
    });

    it('rejects late cleanup of A after C claims the scoped slot', () => {
        const owner = sender();
        const epoch = invoke('begin-stream-header-session', owner) as number;
        expect(invoke('set-user-agent', owner, 'Agent-A', null, STREAM_A,
            { authorization: 'Bearer A' }, { epoch, generation: 1 })).toBe(true);
        expect(invoke('set-user-agent', owner, 'Agent-C', null, STREAM_C,
            { authorization: 'Bearer C' }, { epoch, generation: 3 })).toBe(true);
        const before = mockClearScoped.mock.calls.length;
        expect(invoke('release-stream-headers', owner,
            { epoch, generation: 4 }, STREAM_A)).toBe(false);
        expect(mockClearScoped).toHaveBeenCalledTimes(before);
        expect(invoke('release-stream-headers', owner,
            { epoch, generation: 4 }, STREAM_C)).toBe(true);
        expect(mockClearScoped).toHaveBeenCalledTimes(before + 1);
    });

    it('rejects the old session on renderer crash and revokes credentials', () => {
        const owner = sender(123);
        const epoch = invoke('begin-stream-header-session', owner) as number;
        invoke('set-user-agent', owner, 'Agent', null, STREAM_A,
            { cookie: 'mac=private' }, { epoch, generation: 1 });
        const before = mockClearScoped.mock.calls.length;
        owner.emit('render-process-gone');
        expect(mockClearScoped).toHaveBeenCalledTimes(before + 1);
        expect(invoke('set-user-agent', owner, 'Late', null, STREAM_A,
            null, { epoch, generation: 2 })).toBe(false);
    });

    it('ignores a destruction callback from a replaced renderer session', () => {
        const first = sender(140);
        const oldEpoch = invoke('begin-stream-header-session', first) as number;
        const nextEpoch = invoke('begin-stream-header-session', first) as number;
        expect(nextEpoch).toBeGreaterThan(oldEpoch);
        invoke('set-user-agent', first, 'New', null, STREAM_C,
            null, { epoch: nextEpoch, generation: 1 });
        const before = mockClearScoped.mock.calls.length;
        // Both callbacks run, but only the latest epoch is authorized.
        first.emit('destroyed');
        expect(mockClearScoped).toHaveBeenCalledTimes(before + 1);
        expect(invoke('set-user-agent', first, 'Old', null, STREAM_A,
            null, { epoch: oldEpoch, generation: 99 })).toBe(false);
    });

    it('rejects obsolete unleased scoped callers after the first session', () => {
        const owner = sender(150);
        invoke('begin-stream-header-session', owner);
        expect(invoke('set-user-agent', owner, 'Unleased', null, STREAM_A)).toBe(false);
        expect(mockConfigure).not.toHaveBeenCalled();
    });

    it('does not issue a lease for a destroyed renderer', () => {
        const owner = sender(160);
        owner.isDestroyed.mockReturnValue(true);
        expect(invoke('begin-stream-header-session', owner)).toBe(0);
    });
});
