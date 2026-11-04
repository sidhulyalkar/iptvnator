import type { StalkerPortalItem } from '@iptvnator/shared/interfaces';

/** ITV and radio use the same portal-wide favorite array, often with reused IDs. */
export function filterPortalFavoritesForRemoval<T>(
    favorites: readonly T[],
    favoriteId: number | string,
    contentType?: 'itv' | 'radio'
): { retained: T[]; removed: boolean } {
    const expectedId = String(favoriteId).trim();
    if (!expectedId) return { retained: [...favorites], removed: false };

    // Untyped legacy operations may delete only a single provable record.
    // Reused numeric IDs across ITV, VOD, and radio must never fan out.
    const matching = favorites.filter((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const favorite = entry as unknown as StalkerPortalItem;
        return [
            favorite.stream_id,
            favorite.series_id,
            favorite.movie_id,
            favorite.id,
        ].some((id) => id != null && String(id).trim() === expectedId);
    });
    if (!contentType && matching.length !== 1) {
        return { retained: [...favorites], removed: false };
    }

    let removed = false;
    const retained = favorites.filter((entry) => {
        if (!entry || typeof entry !== 'object') return true;
        const favorite = entry as unknown as StalkerPortalItem;
        const matches = [
            favorite.stream_id,
            favorite.series_id,
            favorite.movie_id,
            favorite.id,
        ].some((id) => id != null && String(id).trim() === expectedId);
        if (!matches) return true;

        // Typed operations require actual category evidence. Numeric category
        // IDs in historical records are ambiguous and remain untouched.
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
