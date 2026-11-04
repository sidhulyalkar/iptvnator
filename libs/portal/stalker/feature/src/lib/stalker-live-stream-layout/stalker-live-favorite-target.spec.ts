import {
    createStalkerLiveFavoriteTarget,
    hasStalkerLiveFavorite,
} from './stalker-live-favorite-target';

const item = {
    id: '42',
    cmd: 'ffmpeg https://stream.example/live',
    name: 'News',
    o_name: 'News HD',
    logo: 'news.png',
};

describe('Stalker live favorite identity', () => {
    const playlist = {
        _id: 'source-1',
        title: 'https://user:secret@portal.example.com/path',
    };
    const identity = { sourceId: 'source-1', contentId: '42' };

    it('binds the committed stream rather than a highlighted category row', () => {
        expect(
            createStalkerLiveFavoriteTarget(playlist, identity, item, true, false)
        ).toEqual({
            playlistId: 'source-1',
            channelId: '42',
            favoriteId: '42',
            channelName: 'News HD',
            sourceName: playlist.title,
            item,
        });
    });

    it('does not offer actions for a stale source, next channel or radio', () => {
        expect(
            createStalkerLiveFavoriteTarget(
                playlist,
                { ...identity, sourceId: 'other' },
                item,
                true,
                false
            )
        ).toBeNull();
        expect(
            createStalkerLiveFavoriteTarget(
                playlist,
                { ...identity, contentId: '43' },
                item,
                true,
                false
            )
        ).toBeNull();
        expect(
            createStalkerLiveFavoriteTarget(playlist, identity, item, true, true)
        ).toBeNull();
        expect(
            createStalkerLiveFavoriteTarget(playlist, identity, item, false, false)
        ).toBeNull();
        expect(
            createStalkerLiveFavoriteTarget(null, identity, item, true, false)
        ).toBeNull();
    });

    it('prefers stream_id for saved favorites but retains playback id', () => {
        expect(
            createStalkerLiveFavoriteTarget(
                playlist,
                identity,
                { ...item, stream_id: 'canonical-99' },
                true,
                false
            )
        ).toEqual(
            expect.objectContaining({
                channelId: '42',
                favoriteId: 'canonical-99',
            })
        );
    });

    it('matches legacy and new live IDs without treating VOD as live', () => {
        expect(
            hasStalkerLiveFavorite(
                [
                    { id: '42', category_id: 'vod' },
                    { stream_id: '   ', id: '42', category_id: 'itv' },
                ],
                '42'
            )
        ).toBe(true);
        expect(
            hasStalkerLiveFavorite(
                [{ id: '42', category_id: 'radio' }],
                '42'
            )
        ).toBe(false);
        expect(
            hasStalkerLiveFavorite([{ stream_id: '42', category_id: 'itv' }], '42')
        ).toBe(true);
        expect(
            hasStalkerLiveFavorite([{ id: '42', category_id: '17' }], '42')
        ).toBe(false);
        expect(
            hasStalkerLiveFavorite([{ id: '42' }], '42')
        ).toBe(false);
        expect(
            hasStalkerLiveFavorite([
                { id: '42', category_id: 'vod' },
                { id: '42', category_id: 'radio' },
                { id: '42', category_id: '17' },
            ], '42')
        ).toBe(false);
    });
});
