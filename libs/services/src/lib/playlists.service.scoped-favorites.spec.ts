import { firstValueFrom, from, of } from 'rxjs';
import type { Playlist } from '@iptvnator/shared/interfaces';
import { PlaylistsService } from './playlists.service';

describe('PlaylistsService scoped Stalker favorite removal', () => {
    const source: Playlist = {
        _id: 'portal-1',
        title: 'Portal',
        count: 0,
        importDate: '',
        lastUsage: '',
        autoRefresh: false,
        favorites: [
            { id: '42', stream_id: '42', category_id: 'itv' },
            { id: '42', movie_id: '42', category_id: 'vod' },
            { id: '42', category_id: 'radio' },
            { id: '42', category_id: '17' },
        ],
    };

    function setup(playlist: Playlist = source) {
        // Exercise the actual service method and bypass only storage transport.
        const service = Object.create(PlaylistsService.prototype) as PlaylistsService;
        const persist = jest.fn(async (next: Playlist) => next);
        Object.assign(service, {
            getPlaylistById: jest.fn(() => of(playlist)),
            persistPlaylistMutation: persist,
            serializePlaylistWrite: jest.fn(
                (_portalId: string, operation: () => Promise<unknown>) =>
                    from(operation())
            ),
        });
        return { service, persist };
    }

    it('retains radio and VOD collisions when removing a typed ITV record', async () => {
        const { service, persist } = setup();
        await firstValueFrom(
            service.removeFromPortalFavorites('portal-1', '42', 'itv')
        );
        expect(persist).toHaveBeenCalledWith(
            expect.objectContaining({
                favorites: source.favorites?.slice(1),
            })
        );
        expect(source.favorites).toHaveLength(4);
    });

    it('rejects unscoped deletion when reused IDs collide across types', async () => {
        const { service, persist } = setup();
        await expect(
            firstValueFrom(service.removeFromPortalFavorites('portal-1', '42'))
        ).rejects.toThrow('STALKER_FAVORITE_SCOPE_UNVERIFIED');
        expect(persist).not.toHaveBeenCalled();
    });

    it('refuses to mutate a portal when the requested type is ambiguous', async () => {
        const { service, persist } = setup({
            ...source,
            favorites: [
                { id: '42', category_id: '17' },
                { id: '42', category_id: 'vod' },
            ],
        });
        await expect(
            firstValueFrom(
                service.removeFromPortalFavorites('portal-1', '42', 'itv')
            )
        ).rejects.toThrow('STALKER_FAVORITE_SCOPE_UNVERIFIED');
        expect(persist).not.toHaveBeenCalled();
    });
});
