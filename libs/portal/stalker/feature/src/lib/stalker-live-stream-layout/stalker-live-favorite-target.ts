import type { StalkerItvChannel, StalkerFavoriteItem } from '@iptvnator/portal/stalker/data-access';
import { normalizeStalkerEntityId } from '@iptvnator/portal/stalker/data-access';

export interface StalkerLiveFavoriteTarget {
    readonly playlistId: string;
    readonly channelId: string;
    /** Actual persisted portal key; may differ from the selection id. */
    readonly favoriteId: string;
    readonly channelName: string;
    readonly sourceName: string;
    readonly item: StalkerItvChannel;
}

/** Only the channel that owns an actual committed video player may be saved. */
export function createStalkerLiveFavoriteTarget(
    playlist: { _id?: string; title?: string } | null | undefined,
    identity: { sourceId: string; contentId: string } | null,
    item: StalkerItvChannel | null,
    mounted: boolean,
    radioMode: boolean
): StalkerLiveFavoriteTarget | null {
    if (!mounted || radioMode || !identity || !item) return null;
    const playlistId = normalizeStalkerEntityId(playlist?._id);
    const channelId = normalizeStalkerEntityId(item.id);
    const favoriteId = normalizeStalkerEntityId(item.stream_id) || channelId;
    const name = (item.o_name || item.name || '').trim();
    if (
        !playlistId || !channelId || !name ||
        playlistId !== identity.sourceId ||
        channelId !== identity.contentId
    ) return null;
    return {
        playlistId,
        channelId,
        favoriteId,
        channelName: name,
        sourceName: playlist?.title ?? '',
        item,
    };
}

/** Both old id-only and newer stream_id Stalker favorite rows are accepted. */
export function hasStalkerLiveFavorite(
    favorites: readonly StalkerFavoriteItem[],
    channelId: string
): boolean {
    return favorites.some((favorite) => {
        const contentType = String(favorite.category_id ?? '')
            .trim()
            .toLowerCase();
        // A legacy numeric category ID is not proof that this is ITV.
        // The same provider ID can also identify radio, VOD, or series.
        if (contentType !== 'itv') return false;
        const streamId = normalizeStalkerEntityId(favorite.stream_id);
        const id = streamId || normalizeStalkerEntityId(favorite.id);
        return Boolean(id) && id === channelId;
    });
}
