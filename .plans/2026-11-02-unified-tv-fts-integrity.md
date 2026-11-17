# EPG historical FTS integrity qualification

- [x] Verify SQLite external-content integrity-check rank=1 against missing pre-FTS rows.
- [x] Add worker-only transactional verification/rebuild and durable trust marker.
- [x] Gate main-process FTS search on the marker; preserve literal LIKE fallback.
- [x] Add historical, healthy, missing table and idempotence regression fixtures.
- [x] Extend focused Electron CI workflow paths, release notes, architecture documentation.
- [ ] Execute latest-commit Nx Jest, TypeScript, lint and CodeQL checks.
- [ ] Capture canonical J3/J4 performance with large realistic guide data.
- [ ] Complete local Codex and Greptile review gate; keep draft pending approval.
- [ ] Consider dedicated idle maintenance worker for users who never refresh XMLTV.
