/** Bound the EPG search IPC query before it touches SQLite. */
export interface EpgSearchPlan {
    ftsQuery: string | null;
    likePattern: string;
    limit: number;
}

const MAX_SEARCH_LENGTH = 200;
const MAX_LIMIT = 100;
const MAX_FTS_TOKENS = 8;

export function planEpgSearch(
    query: unknown,
    requestedLimit: unknown
): EpgSearchPlan | null {
    if (typeof query !== 'string') return null;
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > MAX_SEARCH_LENGTH) return null;

    const limit = typeof requestedLimit === 'number' &&
        Number.isSafeInteger(requestedLimit)
        ? Math.min(MAX_LIMIT, Math.max(1, requestedLimit))
        : 50;
    // SQLite LIKE treats % and _ as wildcards. The original query should
    // only match literal characters, including for untrusted IPC input.
    const escaped = trimmed.replace(/[\\%_]/g, '\\$&');
    const words = trimmed.match(/[\p{L}\p{N}]+/gu) ?? [];
    const canUseFts = !/[\\%_]/.test(trimmed) && words.length > 0 &&
        words.length <= MAX_FTS_TOKENS &&
        words.every((word) => word.length >= 2);
    // FTS MATCH syntax is never constructed from raw user punctuation.
    // Each validated word becomes a quoted, literal FTS token.
    const ftsQuery = canUseFts
        ? words.map((word) => '"' + word + '"').join(' AND ')
        : null;
    return {
        ftsQuery,
        likePattern: '%' + escaped + '%',
        limit,
    };
}
