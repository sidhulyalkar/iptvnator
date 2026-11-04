import type { StalkerPortalItem } from '@iptvnator/shared/interfaces';

/**
 * Stalker uses a portal-wide favorites array; its IDs can collide across
 * ITV, radio, VOD, series, and even two records of the same content type.
 * A destructive operation needs exactly one provable record.
 */
export function filterPortalFavoritesForRemoval<T>(
    favorites: readonly T[],
    favoriteId: number | string,
    contentType?: 'itv' | 'radio'
): { retained: T[]; removed: boolean } {
    const expectedId = String(favoriteId).trim();
    if (!expectedId) return { retained: [...favorites], removed: false };

    const matchesIdentity = (entry: T): boolean => {
        if (!entry || typeof entry !== 'object') return false;
        const favorite = entry as unknown as StalkerPortalItem;
        const kind = String(favorite.category_id ?? '').trim().toLowerCase();
        if (contentType && kind !== contentType) return false;

        if (contentType) {
            // The canonical live ID takes priority. An alternate catalog id
            // must not accidentally delete a different stream_id record.
            const canonical = favorite.stream_id ?? favorite.id;
            return canonical != null && String(canonical).trim() === expectedId;
        }

        // The old untyped caller may have supplied any legacy identity.
        // It is safe only when precisely one stored record matches.
        return [
            favorite.stream_id,
            favorite.series_id,
            favorite.movie_id,
            favorite.id,
        ].some((id) => id != null && String(id).trim() === expectedId);
    };

    const matched = favorites.filter(matchesIdentity);
    if (matched.length !== 1) {
        return { retained: [...favorites], removed: false };
    }
    const target = matched[0];

    // Reference identity removes one record, never all records sharing a
    // provider ID, and does not mutate the saved input array.
    return {
        retained: favorites.filter((entry) => entry !== target),
        removed: true,
    };
}
