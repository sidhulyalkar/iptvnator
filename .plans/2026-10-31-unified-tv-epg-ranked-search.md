# Sprint 2b: EPG indexed and time-ranked search

- [x] Preserve the existing EPG IPC response shape.
- [x] Prefer indexed FTS5 for valid token queries.
- [x] Keep literal escaped LIKE fallback for partial, Unicode and legacy cases.
- [x] Show now, upcoming, then archive; use offset-safe SQLite time parsing.
- [x] Cap input and result counts, prevent SQL/FTS injection.
- [x] Add real SQLite FTS5 test fixture covering boundaries and legacy fallback.
- [ ] Verify full backend CI and J3/J4 performance journeys.
- [ ] Complete Codex/Greptile review gate, then reconcile upstream stack before merge.
