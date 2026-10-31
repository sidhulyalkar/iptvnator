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

interface EpgSearchRow {
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

const loggerLabel = '[EPG DB]';

ipcMain.handle(
    'EPG_DB_SEARCH_PROGRAMS',
    async (_event, searchTerm: unknown, requestedLimit: unknown = 50) => {
        const plan = planEpgSearch(searchTerm, requestedLimit);
        if (!plan) return [];
        try {
            const db = await getDatabase();
            const nowIso = new Date().toISOString();
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
            if (plan.ftsQuery !== null) {
                try {
                    const indexed = (await db.all(sql`
                        SELECT p.*, c.display_name AS channel_name
                        FROM epg_programs_fts
                        JOIN epg_programs p ON p.id = epg_programs_fts.rowid
                        LEFT JOIN epg_channels c ON p.channel_id = c.id
                        WHERE epg_programs_fts MATCH ${plan.ftsQuery}
                        ${ordering}
                    `)) as EpgSearchRow[];
                    if (indexed.length) return indexed.map(toSearchProgram);
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
            const escapeCharacter = '\\';
            const fallback = (await db.all(sql`
                SELECT p.*, c.display_name AS channel_name
                FROM epg_programs p
                LEFT JOIN epg_channels c ON p.channel_id = c.id
                WHERE p.title LIKE ${plan.likePattern} ESCAPE ${escapeCharacter}
                   OR p.description LIKE ${plan.likePattern} ESCAPE ${escapeCharacter}
                   OR p.category LIKE ${plan.likePattern} ESCAPE ${escapeCharacter}
                ${ordering}
            `)) as EpgSearchRow[];
            return fallback.map(toSearchProgram);
        } catch (error) {
            console.error(loggerLabel, 'Error searching EPG programs:', error);
            throw error;
        }
    }
);
