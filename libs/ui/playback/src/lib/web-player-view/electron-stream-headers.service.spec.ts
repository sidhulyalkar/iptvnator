import { TestBed } from '@angular/core/testing';
import {
    ELECTRON_STREAM_HEADER_SETUP_TIMEOUT_MS,
    ElectronStreamHeadersService,
} from './electron-stream-headers.service';

const STREAM_URL = 'http://portal.example:8080/live/ch1.ts';
const GATED_PLAYBACK = {
    streamUrl: STREAM_URL,
    title: 'Gated Channel',
    headers: {
        'User-Agent': 'MAG250',
        Referer: 'http://portal.example',
        Cookie: 'mac=00%3A1A%3A79%3A00%3A00%3A01; stb_lang=en_US',
        Authorization: 'Bearer TOKEN123',
    },
};

describe('ElectronStreamHeadersService', () => {
    let service: ElectronStreamHeadersService;
    let setUserAgent: jest.Mock;

    beforeEach(() => {
        setUserAgent = jest.fn().mockResolvedValue(true);
        (window as unknown as { electron?: unknown }).electron = {
            setUserAgent,
        };
        service = TestBed.inject(ElectronStreamHeadersService);
    });

    afterEach(() => {
        delete (window as unknown as { electron?: unknown }).electron;
    });

    it('returns null without an Electron bridge (PWA)', () => {
        delete (window as unknown as { electron?: unknown }).electron;

        expect(service.apply(GATED_PLAYBACK)).toBeNull();
        expect(setUserAgent).not.toHaveBeenCalled();
    });

    it('extracts the full header set and scopes it to the stream URL', async () => {
        await expect(service.apply(GATED_PLAYBACK)).resolves.toBe(true);

        expect(setUserAgent).toHaveBeenCalledWith(
            'MAG250',
            'http://portal.example',
            STREAM_URL,
            {
                authorization: 'Bearer TOKEN123',
                cookie: 'mac=00%3A1A%3A79%3A00%3A00%3A01; stb_lang=en_US',
            }
        );
    });

    it('prefers explicit userAgent/referer fields over the headers map', async () => {
        await service.apply({
            ...GATED_PLAYBACK,
            userAgent: 'ExplicitAgent/1.0',
            referer: 'http://explicit.example',
        });

        expect(setUserAgent).toHaveBeenCalledWith(
            'ExplicitAgent/1.0',
            'http://explicit.example',
            STREAM_URL,
            expect.anything()
        );
    });

    it('omits the credentials object when the playback carries none', async () => {
        await service.apply({
            streamUrl: 'https://example.com/live/plain.m3u8',
            title: 'Plain Channel',
            userAgent: 'PlainAgent/1.0',
        });

        expect(setUserAgent).toHaveBeenCalledWith(
            'PlainAgent/1.0',
            undefined,
            'https://example.com/live/plain.m3u8',
            undefined
        );
    });

    it('reports a superseded apply as not current', async () => {
        const resolvers: Array<() => void> = [];
        setUserAgent.mockImplementation(
            () =>
                new Promise<boolean>((resolve) =>
                    resolvers.push(() => resolve(true))
                )
        );

        const first = service.apply(GATED_PLAYBACK);
        const second = service.apply({
            ...GATED_PLAYBACK,
            streamUrl: 'http://portal.example:8080/live/ch2.ts',
        });

        // The old waiter settles immediately, even if its IPC hangs.
        await expect(first).resolves.toBe(false);
        resolvers[1]();
        await expect(second).resolves.toBe(true);
        // A late result cannot revive the superseded request.
        resolvers[0]();
    });

    it('clears the override only while the caller still owns the slot', async () => {
        await service.apply(GATED_PLAYBACK);
        setUserAgent.mockClear();

        // A stale consumer (e.g. a destroyed component) must not wipe the
        // override a newer playback configured.
        service.clear('http://portal.example:8080/other-stream.ts');
        expect(setUserAgent).not.toHaveBeenCalled();

        service.clear(STREAM_URL);
        expect(setUserAgent).toHaveBeenCalledWith(
            undefined,
            undefined,
            STREAM_URL
        );
    });

    it('does not clear twice for the same stream', async () => {
        await service.apply(GATED_PLAYBACK);
        service.clear(STREAM_URL);
        setUserAgent.mockClear();

        service.clear(STREAM_URL);
        expect(setUserAgent).not.toHaveBeenCalled();
    });

    it('resolves instead of throwing when the bridge rejects', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {
            /* silence */
        });
        setUserAgent.mockRejectedValue(new Error('ipc down'));

        await expect(service.apply(GATED_PLAYBACK)).resolves.toBe(false);
        expect(warn).toHaveBeenCalledWith(
            '[ElectronStreamHeaders] Request-header setup failed'
        );
        warn.mockRestore();
    });
    it('does not expose a synchronous IPC exception or treat it as success', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        setUserAgent.mockImplementation(() => {
            throw new Error('private cookie=should-not-be-logged');
        });
        await expect(service.apply(GATED_PLAYBACK)).resolves.toBe(false);
        expect(warn).toHaveBeenCalledWith(
            '[ElectronStreamHeaders] Request-header setup failed'
        );
        warn.mockRestore();
    });

    it('bounds a hung Electron header IPC and never reports a late success', async () => {
        jest.useFakeTimers();
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            let finish: (value: boolean) => void = () => undefined;
            setUserAgent.mockImplementation(
                () =>
                    new Promise<boolean>((resolve) => {
                        finish = resolve;
                    })
            );

            const pending = service.apply(GATED_PLAYBACK);
            jest.advanceTimersByTime(ELECTRON_STREAM_HEADER_SETUP_TIMEOUT_MS - 1);
            expect(warn).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1);
            await expect(pending).resolves.toBe(false);
            expect(warn).toHaveBeenCalledWith(
                '[ElectronStreamHeaders] Request-header setup failed'
            );

            finish(true);
            await Promise.resolve();
            // The result stays failed after the late IPC response.
            await expect(pending).resolves.toBe(false);
            expect(warn).toHaveBeenCalledTimes(1);
        } finally {
            warn.mockRestore();
            jest.useRealTimers();
        }
    });

    it('unblocks the superseded waiter before its deadline', async () => {
        jest.useFakeTimers();
        try {
            const resolvers: Array<() => void> = [];
            setUserAgent.mockImplementation(
                () =>
                    new Promise<boolean>((resolve) =>
                        resolvers.push(() => resolve(true))
                    )
            );

            const first = service.apply(GATED_PLAYBACK);
            const second = service.apply({
                ...GATED_PLAYBACK,
                streamUrl: 'http://portal.example:8080/live/ch2.ts',
            });
            await expect(first).resolves.toBe(false);
            expect(resolvers).toHaveLength(2);
            resolvers[1]();
            await expect(second).resolves.toBe(true);
            jest.advanceTimersByTime(ELECTRON_STREAM_HEADER_SETUP_TIMEOUT_MS);
            resolvers[0]();
            await Promise.resolve();
            await expect(first).resolves.toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });

    it('cancels an outstanding handoff when its scoped header lease is cleared', async () => {
        setUserAgent.mockImplementationOnce(
            () => new Promise<boolean>(() => undefined)
        );
        const pending = service.apply(GATED_PLAYBACK);
        service.clear(STREAM_URL);
        await expect(pending).resolves.toBe(false);
        expect(setUserAgent).toHaveBeenLastCalledWith(
            undefined,
            undefined,
            STREAM_URL
        );
    });

});
