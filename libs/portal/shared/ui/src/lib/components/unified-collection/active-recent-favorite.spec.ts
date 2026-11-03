import { buildLiveItem } from './unified-live-tab.spec-data';
import { resolveActiveRecentFavorite } from './active-recent-favorite';

describe('resolveActiveRecentFavorite', () => {
    it.each(['m3u', 'xtream', 'stalker'] as const)(
        'uses the committed %s item, not the selected next row',
        (sourceType) => {
            const active = buildLiveItem(sourceType);
            const other = { ...active, uid: 'different', name: 'Next' };
            const result = resolveActiveRecentFavorite({
                mode: 'recent',
                items: [active, other],
                activeItem: active,
                hasActiveDetail: true,
                selectionPending: false,
            });
            expect(result).toEqual(active);
        }
    );

    it('hides during resolution, outside recent or before a playback commits', () => {
        const active = buildLiveItem('m3u');
        const context = {
            mode: 'recent' as const,
            items: [active],
            activeItem: active,
            hasActiveDetail: true,
            selectionPending: false,
        };
        expect(
            resolveActiveRecentFavorite({ ...context, selectionPending: true })
        ).toBeNull();
        expect(
            resolveActiveRecentFavorite({ ...context, mode: 'favorites' })
        ).toBeNull();
        expect(
            resolveActiveRecentFavorite({ ...context, hasActiveDetail: false })
        ).toBeNull();
        expect(
            resolveActiveRecentFavorite({ ...context, activeItem: null })
        ).toBeNull();
    });

    it('rejects missing, mismatched-provider and unavailable rows', () => {
        const active = buildLiveItem('xtream');
        const context = {
            mode: 'recent' as const,
            items: [active],
            activeItem: active,
            hasActiveDetail: true,
            selectionPending: false,
        };
        expect(resolveActiveRecentFavorite({ ...context, items: [] })).toBeNull();
        expect(resolveActiveRecentFavorite({
            ...context,
            items: [{ ...active, playlistId: 'other' }],
        })).toBeNull();
        expect(resolveActiveRecentFavorite({
            ...context,
            items: [{ ...active, sourceType: 'stalker' }],
        })).toBeNull();
        expect(resolveActiveRecentFavorite({
            ...context,
            items: [{ ...active, catalogStatus: 'missing' }],
        })).toBeNull();
        expect(resolveActiveRecentFavorite({
            ...context,
            items: [{ ...active, catalogStatus: 'unknown' }],
        })).toBeNull();
        expect(resolveActiveRecentFavorite({
            ...context,
            activeItem: { ...active, contentType: 'movie' },
        })).toBeNull();
        expect(resolveActiveRecentFavorite({
            ...context,
            items: [{ ...active, contentType: 'movie' }],
        })).toBeNull();
    });
});
