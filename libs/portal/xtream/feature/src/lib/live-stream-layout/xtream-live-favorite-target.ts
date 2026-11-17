export interface XtreamLiveFavoriteTarget {
    readonly playlistId: string;
    readonly xtreamId: number;
    readonly channelName: string;
    /** Raw provider name is only rendered through the shared redacting helper. */
    readonly sourceName: string;
}

export function createXtreamLiveFavoriteTarget(
    playlist:
        | {
              readonly id: string;
              readonly name?: string | null;
              readonly title?: string | null;
          }
        | null
        | undefined,
    item: {
        readonly xtream_id: number;
        readonly name?: string | null;
        readonly title?: string | null;
    }
): XtreamLiveFavoriteTarget | null {
    const name = (item.title || item.name || '').trim();
    if (
        !playlist?.id ||
        !Number.isSafeInteger(item.xtream_id) ||
        item.xtream_id <= 0 ||
        !name
    ) {
        return null;
    }
    return {
        playlistId: playlist.id,
        xtreamId: item.xtream_id,
        channelName: name,
        sourceName: playlist.name ?? playlist.title ?? '',
    };
}
