import { isCatalogUnavailable } from '@iptvnator/shared/interfaces';
import type { UnifiedCollectionItem } from '@iptvnator/portal/shared/util';

interface ActiveRecentFavoriteContext {
    readonly mode: 'favorites' | 'recent';
    readonly items: readonly UnifiedCollectionItem[];
    readonly activeItem: UnifiedCollectionItem | null;
    readonly hasActiveDetail: boolean;
    readonly selectionPending: boolean;
}

/**
 * Keep the favorite action attached to the actually mounted playback, not
 * the highlighted next channel or a missing/unavailable catalog row.
 */
export function resolveActiveRecentFavorite(
    context: ActiveRecentFavoriteContext
): UnifiedCollectionItem | null {
    if (
        context.mode !== 'recent' ||
        !context.hasActiveDetail ||
        context.selectionPending ||
        !context.activeItem
    ) {
        return null;
    }

    const active = context.activeItem;
    if (active.contentType !== 'live') return null;

    const current = context.items.find(
        (item) =>
            item.uid === active.uid &&
            item.contentType === 'live' &&
            item.playlistId === active.playlistId &&
            item.sourceType === active.sourceType
    );
    return current && !isCatalogUnavailable(current) ? current : null;
}
