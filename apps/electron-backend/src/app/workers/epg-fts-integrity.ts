import type BetterSqlite3 from 'better-sqlite3';

/**
 * FTS5 with external content can silently omit older programmes even when
 * MATCH returns a full page. Search may trust FTS only after this marker has
 * been committed by a worker-side external-content integrity check.
 *
 * Do not move this to SQLite initialization or the Electron IPC hot path.
 */
export const EPG_FTS_INTEGRITY_KEY =
    'epg:fts-external-content-integrity:v1';
export const EPG_FTS_INTEGRITY_VALUE = 'verified-external-content-v1';

export type EpgFtsIntegrityResult = 'already-verified' | 'verified' | 'rebuilt';

type Sqlite = Pick<BetterSqlite3.Database, 'prepare' | 'transaction'>;

export function ensureEpgFtsIndex(
    db: Sqlite
): EpgFtsIntegrityResult {
    // The marker is durable only after a successful worker-side integrity
    // check. The FTS5 triggers keep it accurate across ordinary imports.
    const marker = db.prepare(
        'SELECT value FROM app_state WHERE key = ?'
    ).get(EPG_FTS_INTEGRITY_KEY) as { value?: string } | undefined;
    if (marker?.value === EPG_FTS_INTEGRITY_VALUE) {
        return 'already-verified';
    }

    return db.transaction(() => {
        const check = db.prepare(
            "INSERT INTO epg_programs_fts(epg_programs_fts, rank) " +
            "VALUES('integrity-check', 1)"
        );
        let rebuilt = false;
        try {
            check.run();
        } catch {
            // A failed rank=1 check can mean a missing external-content row,
            // not a broken database file. FTS5 rebuild reads epg_programs.
            // Both the rebuild and the marker commit atomically.
            db.prepare(
                "INSERT INTO epg_programs_fts(epg_programs_fts) " +
                "VALUES('rebuild')"
            ).run();
            check.run(); // A second failure rolls back the entire transaction.
            rebuilt = true;
        }
        db.prepare(
            "INSERT INTO app_state (key, value, updated_at) " +
            "VALUES (?, ?, datetime('now')) " +
            "ON CONFLICT(key) DO UPDATE SET " +
            "value = excluded.value, updated_at = excluded.updated_at"
        ).run(EPG_FTS_INTEGRITY_KEY, EPG_FTS_INTEGRITY_VALUE);
        return rebuilt ? 'rebuilt' : 'verified';
    })();
}
