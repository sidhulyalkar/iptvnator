# Indexed and time-ranked EPG search

**Scope:** Electron programme-search IPC, not playback. This PR stacks on the sports resolver.

The current handler scans all programmes with LIKE and sorts by ascending `start`, allowing old archived rows to consume the first page before current games. This change uses IPTVnator's existing `epg_programs_fts` index as the first query path, with bounded, quoted FTS search tokens. It ranks matches as **currently airing → upcoming → archived**. SQLite `julianday` correctly compares timezone-qualified XMLTV intervals.

When FTS has no matches, is unavailable, or the query has unsupported token structure, the handler uses a literal, escaped `LIKE` fallback. This preserves partial-word matching and guide access for older or incompletely indexed databases. Limit is capped at 100 and input at 200 characters. No new persistence schema, migration, media request or channel activation is introduced.

## Important limits

- The FTS index is not guaranteed to contain every historical row in old installations. When FTS returns **fewer than the requested limit**, indexed and literal-LIKE candidates are merged, deduplicated by database row ID, and time-ranked. However, when FTS already fills the page, unindexed rows can still be omitted. A complete correctness guarantee requires an asynchronous index reconciliation/backfill or a trusted completeness marker before FTS-first paging is enabled.
- Time ranking uses the system's UTC clock. It doesn't receive the optional user-configured EPG display offset. The renderer's explicit live/upcoming filter still uses its corrected provider clock.
- Matching programme metadata does not establish broadcasting rights, source authorization, decoded first frame, or stream readiness.
- Search performance targets require actual J4 benchmarks with large authorized EPG data. No speculative performance claims or ratchet changes.
- SQLite `julianday()` sorting happens after indexed FTS candidate selection; fallback LIKE remains comparatively expensive. Sparse-index repair trades some query cost for better recall. No quantitative speedup is established without J4 benchmarks.

## Verification

Run backend unit/in-memory SQLite tests, backend and spec typechecking, and lint. Verify J4 and J3 performance journeys and live-guide accessibility on actual desktop hardware before merging.

### Operational rollback

Set `IPTVNATOR_EPG_SEARCH_LEGACY=1` **before launching Electron** to disable the indexed live-first search and use the historical oldest-first literal substring ordering. It retains the safety bounds and LIKE escaping. This is a temporary kill switch; remove it within two releases after the EPG ranking change is proven. No database reset or EPG re-import is required to roll back the search behavior.
