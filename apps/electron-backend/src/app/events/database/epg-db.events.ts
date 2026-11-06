/**
 * EPG programme search owned by Electron. The guide and playback bridge
 * contracts remain unchanged; no player, stream URL, or source credential
 * is accessed by this handler.
 */
import { sql } from 'drizzle-orm';
import { ipcMain } from 'electron';
import type { ElectronBridgeEpgSearchProgram } from '@iptvnator/shared/interfaces';
import { getDatabase } from '../../database/connection';
import { planEpgSearch } from './epg-search-plan.util';
import {
    EPG_FTS_INTEGRITY_KEY,
    EPG_FTS_INTEGRITY_VALUE,
} from '../../workers/epg-fts-integrity';

interface EpgSearchRow {
    id: number;
    channel_id: string;
    start: string;
    stop: string;
    title: string;
    description: string | null;
    category: string | null;
    icon_url: string | null;
    rating: string | null;
    episode_num: string | null;
    channel_name: string | null;
}

export function toSearchProgram(
    row: EpgSearchRow
): ElectronBridgeEpgSearchProgram {
    return {
        start: row.start,
        stop: row.stop,
        channel: row.channel_id,
        title: row.title,
        desc: row.description,
        category: row.category,
        iconUrl: row.icon_url,
        rating: row.rating,
        episodeNum: row.episode_num,
        channelName: row.channel_name ?? null,
    };
}


/**
 * Merge ranked FTS hits with bounded literal matches when fewer than one
 * result page is indexed. Older databases may have created FTS5 after some
 * EPG rows were imported, so a non-empty index alone is NOT complete proof.
 */
function mergeSparseIndexResults(
    indexed: EpgSearchRow[],
    fallback: EpgSearchRow[],
    limit: number,
    nowMs: number
): EpgSearchRow[] {
    const rows = new Map<string, EpgSearchRow>();
    for (const row of [...indexed, ...fallback]) {
        const key = typeof row.id === 'number'
            ? String(row.id)
            : JSON.stringify([row.channel_id, row.start, row.title]);
        if (!rows.has(key)) rows.set(key, row);
    }
    const priority = (row: EpgSearchRow): [number, number] => {
        const start = Date.parse(row.start);
        const stop = Date.parse(row.stop);
        if (Number.isFinite(start) && Number.isFinite(stop) &&
            start <= nowMs && stop > nowMs) return [0, -start];
        if (Number.isFinite(start) && start > nowMs) return [1, start];
        return [2, Number.isFinite(start) ? -start : 0];
    };
    return [...rows.values()].sort((a, b) => {
        const x = priority(a), y = priority(b);
        return x[0] - y[0] || x[1] - y[1] ||
            a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) ||
            a.channel_id.localeCompare(b.channel_id);
    }).slice(0, limit);
}

const loggerLabel = '[EPG DB]';

ipcMain.handle(
    'EPG_DB_SEARCH_PROGRAMS',
    async (_event, searchTerm: unknown, requestedLimit: unknown = 50) => {
        const plan = planEpgSearch(searchTerm, requestedLimit);
        if (!plan) return [];
        try {
            const db = await getDatabase();
            const nowMs = Date.now();
            const nowIso = new Date(nowMs).toISOString();
            // Emergency rollback switch for search-ranking regressions.
            // This reproduces the historical oldest-first ordering, without
            // relaxing bounded input or SQL parameterization.
            const escapeCharacter = '\\';
            if (process.env.IPTVNATOR_EPG_SEARCH_LEGACY === '1') {
                const legacy = (await db.all(sql`
                    SELECT p.*, c.display_name AS channel_name
                    FROM epg_programs p
                    LEFT JOIN epg_channels c ON p.channel_id = c.id
                    WHERE p.title LIKE ${plan.likePattern} ESCAPE ${escapeCharacter}
                       OR p.description LIKE ${plan.likePattern} ESCAPE ${escapeCharacter}
                       OR p.category LIKE ${plan.likePattern} ESCAPE ${escapeCharacter}
                    ORDER BY p.start
                    LIMIT ${plan.limit}
                `)) as EpgSearchRow[];
                return legacy.map(toSearchProgram);
            }
            // FTS candidate filtering is index-backed. Time comparison is
            // applied to the reduced result set; SQLite julianday() handles
            // XMLTV instants that include UTC offsets.
            const ordering = sql`
                ORDER BY
                    CASE
                        WHEN julianday(p.start) <= julianday(${nowIso})
                         AND julianday(p.stop) > julianday(${nowIso}) THEN 0
                        WHEN julianday(p.start) > julianday(${nowIso}) THEN 1
                        ELSE 2
                    END,
                    CASE
                        WHEN julianday(p.start) > julianday(${nowIso})
                            THEN julianday(p.start)
                        ELSE -julianday(p.start)
                    END,
                    p.title COLLATE NOCASE,
                    p.channel_id
                LIMIT ${plan.limit}
            `;
            // Do not trust a full MATCH page until the worker has verified
            // that external-content FTS contains *all* pre-existing rows.
            // Missing app_state/marker on older installations fails closed
            // to the literal backing-table search, preserving recall.
            let ftsTrusted = false;
            if (plan.ftsQuery !== null) {
                try {
                    const status = (await db.all(sql`
                        SELECT value FROM app_state
                        WHERE key = ${EPG_FTS_INTEGRITY_KEY}
                    `)) as Array<{ value?: string }>;
                    ftsTrusted =
                        status[0]?.value === EPG_FTS_INTEGRITY_VALUE;
                } catch {
                    // A legacy database may not yet have app_state.
                }
            }
            let indexed: EpgSearchRow[] = [];
            if (ftsTrusted) {
                try {
                    indexed = (await db.all(sql`
                        SELECT p.*, c.display_name AS channel_name
                        FROM epg_programs_fts
                        JOIN epg_programs p ON p.id = epg_programs_fts.rowid
                        LEFT JOIN epg_channels c ON p.channel_id = c.id
                        WHERE epg_programs_fts MATCH ${plan.ftsQuery}
                        ${ordering}
                    `)) as EpgSearchRow[];
                    if (indexed.length >= plan.limit) {
                        return indexed.map(toSearchProgram);
                    }
                } catch {
                    // Legacy or corrupt FTS indexes must never disable
                    // ordinary guide search. A LIKE fallback is slower but
                    // preserves user access without doing a main-thread
                    // index migration here.
                }
            }

            // Literal substring fallback covers partial words, scripts that
            // FTS tokenizes differently, and legacy databases without a
            // populated FTS index. Values remain bound parameters.
            const fallback = (await db.all(sql`
                SELECT p.*, c.display_name AS channel_name
                FROM epg_programs p
                LEFT JOIN epg_channels c ON p.channel_id = c.id
                WHERE p.title LIKE ${plan.likePattern} ESCAPE ${escapeCharacter}
                   OR p.description LIKE ${plan.likePattern} ESCAPE ${escapeCharacter}
                   OR p.category LIKE ${plan.likePattern} ESCAPE ${escapeCharacter}
                ${ordering}
            `)) as EpgSearchRow[];
            // A partially indexed historical guide can have newer rows in
            // FTS and older rows only in the backing table. Keep both when
            // the FTS page is short; never erase the indexed candidates.
            return mergeSparseIndexResults(
                indexed, fallback, plan.limit, nowMs
            ).map(toSearchProgram);
        } catch (error) {
            console.error(loggerLabel, 'Error searching EPG programs:', error);
            throw error;
        }
    }
);
