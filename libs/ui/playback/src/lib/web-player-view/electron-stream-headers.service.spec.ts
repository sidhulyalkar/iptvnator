import { TestBed } from '@angular/core/testing';
import {
    ELECTRON_STREAM_HEADER_SETUP_TIMEOUT_MS,
    ElectronStreamHeadersService,
} from './electron-stream-headers.service';

const A = 'https://portal.example/live/A.m3u8';
const B = 'https://portal.example/live/B.m3u8';
const C = 'https://portal.example/live/C.m3u8';
const PLAYBACK = {
    streamUrl: A,
    title: 'Channel A',
    headers: {
        'User-Agent': 'MAG250',
        Referer: 'https://portal.example',
        Cookie: 'mac=private',
        Authorization: 'Bearer SECRET',
    },
};

describe('ElectronStreamHeadersService', () => {
    let service: ElectronStreamHeadersService;
    let beginStreamHeaderSession: jest.Mock;
    let setUserAgent: jest.Mock;
    let releaseStreamHeaders: jest.Mock;
    const flush = async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    };

    beforeEach(() => {
        TestBed.configureTestingModule({});
        beginStreamHeaderSession = jest.fn().mockResolvedValue(9);
        setUserAgent = jest.fn().mockResolvedValue(true);
        releaseStreamHeaders = jest.fn().mockResolvedValue(true);
        (window as unknown as { electron?: unknown }).electron = {
            beginStreamHeaderSession, setUserAgent, releaseStreamHeaders,
        };
        service = TestBed.inject(ElectronStreamHeadersService);
    });

    afterEach(() => {
        delete (window as unknown as { electron?: unknown }).electron;
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('uses the main-process epoch and sends credentials with a generation', async () => {
        await expect(service.apply(PLAYBACK)).resolves.toBe(true);
        expect(beginStreamHeaderSession).toHaveBeenCalledTimes(1);
        expect(setUserAgent).toHaveBeenCalledWith(
            'MAG250', 'https://portal.example', A,
            { cookie: 'mac=private', authorization: 'Bearer SECRET' },
            { epoch: 9, generation: 1 }
        );
    });

    it('does not require an Electron bridge in the PWA', () => {
        delete (window as unknown as { electron?: unknown }).electron;
        expect(service.apply(PLAYBACK)).toBeNull();
    });

    it('fails closed for an Electron bridge without the lease API', async () => {
        (window as unknown as { electron?: unknown }).electron = { setUserAgent };
        await expect(service.apply(PLAYBACK)).resolves.toBe(false);
        expect(setUserAgent).not.toHaveBeenCalled();
    });

    it('honors explicit playback header fields', async () => {
        await service.apply({
            ...PLAYBACK, userAgent: 'Explicit/1', referer: 'https://ref.example',
        });
        expect(setUserAgent).toHaveBeenCalledWith(
            'Explicit/1', 'https://ref.example', A, expect.anything(),
            { epoch: 9, generation: 1 }
        );
    });

    it('clears previous scoped credentials for a source without headers', async () => {
        await service.apply({ ...PLAYBACK, headers: undefined, userAgent: undefined });
        expect(setUserAgent).toHaveBeenCalledWith(
            undefined, undefined, A, undefined,
            { epoch: 9, generation: 1 }
        );
    });

    it('fences A and B when C is selected during delayed IPC', async () => {
        const resolvers: Array<(ok: boolean) => void> = [];
        setUserAgent.mockImplementation(
            () => new Promise<boolean>((resolve) => resolvers.push(resolve))
        );
        const a = service.apply(PLAYBACK);
        const b = service.apply({ ...PLAYBACK, streamUrl: B });
        const c = service.apply({ ...PLAYBACK, streamUrl: C });
        await flush();
        expect(resolvers).toHaveLength(3);
        await expect(a).resolves.toBe(false);
        await expect(b).resolves.toBe(false);
        resolvers[2](true);
        await expect(c).resolves.toBe(true);
        resolvers[0](true);
        resolvers[1](true);
        await flush();
        expect(releaseStreamHeaders).toHaveBeenCalled();
    });

    it('releases only its active URL and fences late setup', async () => {
        await service.apply(PLAYBACK);
        service.clear(B);
        expect(releaseStreamHeaders).not.toHaveBeenCalled();
        service.clear(A);
        await flush();
        expect(releaseStreamHeaders).toHaveBeenCalledWith(
            { epoch: 9, generation: 2 }, A
        );
        service.clear(A);
        expect(releaseStreamHeaders).toHaveBeenCalledTimes(1);
    });

    it('returns false and revokes when IPC rejects without logging a secret', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        setUserAgent.mockRejectedValue(new Error('cookie=private'));
        await expect(service.apply(PLAYBACK)).resolves.toBe(false);
        await flush();
        expect(releaseStreamHeaders).toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith(
            '[ElectronStreamHeaders] Request-header setup failed'
        );
    });

    it('reacquires a new header session after a failed begin', async () => {
        beginStreamHeaderSession.mockResolvedValueOnce(0).mockResolvedValueOnce(10);
        await expect(service.apply(PLAYBACK)).resolves.toBe(false);
        await expect(service.apply(PLAYBACK)).resolves.toBe(true);
        expect(beginStreamHeaderSession).toHaveBeenCalledTimes(2);
        expect(setUserAgent).toHaveBeenCalledWith(
            expect.anything(), expect.anything(), A,
            expect.anything(), { epoch: 10, generation: 3 }
        );
    });

    it('never reports a late success after its IPC deadline', async () => {
        jest.useFakeTimers();
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        let finish: (value: boolean) => void = () => undefined;
        setUserAgent.mockImplementation(
            () => new Promise<boolean>((resolve) => { finish = resolve; })
        );
        const pending = service.apply(PLAYBACK);
        await flush();
        jest.advanceTimersByTime(ELECTRON_STREAM_HEADER_SETUP_TIMEOUT_MS);
        await expect(pending).resolves.toBe(false);
        await flush();
        expect(releaseStreamHeaders).toHaveBeenCalled();
        finish(true);
        await flush();
        await expect(pending).resolves.toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('does not start media after an unsuccessful main-process acknowledgment', async () => {
        setUserAgent.mockResolvedValue(false);
        await expect(service.apply(PLAYBACK)).resolves.toBe(false);
        await flush();
        expect(releaseStreamHeaders).toHaveBeenCalled();
    });
});
