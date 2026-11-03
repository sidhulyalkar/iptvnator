import { createXtreamLiveFavoriteTarget } from './xtream-live-favorite-target';

describe('createXtreamLiveFavoriteTarget', () => {
    const playlist = { id: 'source-1', name: 'https://user:secret@provider.test/list' };

    it('captures the committed channel identity without embedding credentials', () => {
        expect(
            createXtreamLiveFavoriteTarget(playlist, {
                xtream_id: 41,
                title: 'News',
            })
        ).toEqual({
            playlistId: 'source-1',
            xtreamId: 41,
            channelName: 'News',
            sourceName: playlist.name,
        });
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
        'rejects an invalid provider item id (%s)',
        (xtream_id) => {
            expect(
                createXtreamLiveFavoriteTarget(playlist, {
                    xtream_id,
                    name: 'News',
                })
            ).toBeNull();
        }
    );

    it('omits favorites without a source or channel name', () => {
        expect(
            createXtreamLiveFavoriteTarget(null, {
                xtream_id: 1,
                name: 'News',
            })
        ).toBeNull();
        expect(
            createXtreamLiveFavoriteTarget(playlist, {
                xtream_id: 1,
                name: ' ',
            })
        ).toBeNull();
    });
});
