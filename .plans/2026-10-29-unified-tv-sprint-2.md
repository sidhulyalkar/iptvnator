# Sprint 2 sports resolver (stacked on PR #3)

- [x] Verify current EPG backend query semantics and repair literal-substring matchup mismatch.
- [x] Add optional schedule snapshot contract, UTC freshness gates, league/team alias matching and exact title evidence.
- [x] Separate provider-clock EPG offsets from official event UTC timestamps.
- [x] Add TheSportsDB response normalization without network access or unverified league IDs.
- [x] Unit tests for stale schedules, false opponents, partial response, duplicate channel options and date corrections.
- [ ] Run focused GitHub CI against final head and address failures.
- [ ] Satisfy repository Codex/Greptile review gate and assess full E2E/performance journeys.
- [ ] Add a vetted, user-configured schedule adapter (not part of this PR).
- [ ] Add distinct event/discovery UI states; do not claim EPG candidate is playable.
