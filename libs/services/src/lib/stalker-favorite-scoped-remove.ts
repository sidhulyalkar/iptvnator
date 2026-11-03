import type { StalkerPortalItem } from '@iptvnator/shared/interfaces';

/** ITV and radio use the same portal-wide favorite array, often with reused IDs. */
export function filterPortalFavoritesForRemoval<T>(
    favorites: readonly T[],
    favoriteId: number | string,
    contentType?: 'itv' | 'radio'
): { retained: T[]; removed: boolean } {
    const expectedId = String(favoriteId).trim();
    if (!expectedId) return { retained: [...favorites], removed: false };

    let removed = false;
    const retained = favorites.filter((entry) => {
        const favorite = entry as StalkerPortalItem;
        const matches = [
            favorite.stream_id,
            favorite.series_id,
            favorite.movie_id,
            favorite.id,
        ].some((id) => id != null && String(id).trim() === expectedId);
        if (!matches) return true;

        // Omitted contentType intentionally preserves the legacy call path.
        // New live-player calls require explicit portal-provided type evidence.
        if (
            contentType &&
            String(favorite.category_id ?? '').trim().toLowerCase() !==
                contentType
        ) return true;

        removed = true;
        return false;
    });

    return { retained, removed };
}
