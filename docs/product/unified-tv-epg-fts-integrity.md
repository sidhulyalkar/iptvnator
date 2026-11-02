# EPG full-text index integrity and search trust

This increment adds an **opt-in-by-verification index trust contract**, not a new database. It is stacked on PR #6 and must not merge before the earlier discovery changes.

## Why verification is required

`epg_programs_fts` is an external-content FTS5 table. Ordinary FTS queries can return a full result page despite historical programmes being absent from the index. The previous partial-result merge is insufficient when the indexed page fills its result limit.

The Electron search handler now reads a small durable `app_state` trust marker, `epg:fts-external-content-integrity:v1`. If the marker is absent or the lookup fails, it uses a bounded, literal LIKE search of `epg_programs` rather than trusting FTS. This preserves recall without synchronously rebuilding an index on the main thread.

## Worker-side validation

After **successful** staged EPG publication, the existing EPG import worker calls `ensureEpgFtsIndex`, in `apps/electron-backend/src/app/workers/epg-fts-integrity.ts`:

1. Skip if the one-time, versioned marker is already committed.
2. Run FTS5 `integrity-check` with `rank=1`, which checks the index against the external backing table. Plain `integrity-check` without `rank=1` is insufficient.
3. On mismatch, run FTS5 `rebuild` using the backing table, then recheck.
4. Atomically commit the marker only after a clean check. A failure or worker termination rolls back the marker and leaves search on the safe fallback.

The repair runs on the EPG worker thread rather than the renderer or Electron IPC search request. Invalid index state does **not** block a valid XMLTV import; that import remains successful, but the index stays untrusted until verification succeeds.

## Limitations and follow-up

- The worker is launched for EPG source operations. A user with only historical data and **no subsequent import or refresh** stays on the correct but slower LIKE fallback. An explicit on-idle maintenance job is a future improvement, not silently launched at startup.
- The marker relies on trigger-managed EPG updates. If future migrations replace the FTS table, its tokenizer, or its triggers, invalidate or version the marker in the same migration. Missing/damaged FTS objects at query time still trigger LIKE fallback.
- The main-process trust read adds a small SQL query to token-search requests. Measure it using J4; don't assert a speedup without evidence.
- The first worker-side integrity check/rebuild may be expensive on large guides and lengthen the EPG refresh. If it exceeds import worker lifetime, the transaction must roll back and no marker may be committed. Consider a dedicated maintenance worker and progress/cancellation before optimizing large datasets.
- No user-visible `playable` assertion, channel/source linking, sports schedule API call, credentials, or playback code changed.

## Qualification requirements

`pnpm nx test electron-backend --runInBand`, `pnpm run typecheck:backend`, `pnpm run typecheck:spec`, `pnpm nx lint electron-backend`, real SQLite FTS fixture tests, full CI and CodeQL on the latest commit, J3/J4 performance journeys, and required local Codex/Greptile reviews. Include historical upgrade scenarios with FTS created after the original rows, healthy current indexes, missing/corrupt FTS, repeated import, and invalid/truncated feed rollback.

Do not mark this PR production-ready until these gates pass.
