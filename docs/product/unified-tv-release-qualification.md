# Unified TV discovery: integrated release qualification

**Status 2026-11-02:** Draft stack, not merged. Read this before declaring the project ready.

## Stack and merge order

1. PR #4 is an independent one-line web E2E compile repair, based on `master`. Its main CI, CodeQL, and cross-platform E2E have passed; Windows MPV packaging still fails on an archive download (HTTP 404).
2. PR #1: frozen synthetic golden fixtures and Sprint 0 baseline against `master`.
3. PR #2: standalone SQLite shadow-search research tooling against PR #1, not the active application database.
4. PR #3: real M3U EPG bridge, spoken-query interpretation and stale-request suppression against PR #2.
5. PR #5: schedule candidate matching and strict EPG evidence, optional schedule source with no live provider registered, against PR #3.
6. PR #6: Electron EPG indexed/live-first search, historical-index recall fallback, rollback switch and SQLite regression specs, against PR #5.
7. PR #7: draft integration-validation comparison of the full feature stack to `master`. **Never merge PR #7 as an alternative without explicit maintainer agreement.** It does not automatically include PR #4.

Before merging each stacked PR, update/rebase its base as appropriate and re-verify the resulting diff. Do not merge a PR whose base includes unmerged dependencies into `master` by accident.

## Required qualification gates

| Gate | Status | Evidence/next action |
| --- | --- | --- |
| Sprint 0 synthetic fixtures | Passed at PR #1 head | dedicated synthetic CI |
| Sprint 2 sports match tests | Passed at PR #5 head | EPG integration checks and Docker build |
| Web E2E import fix | Passed on PR #4 head | full cross-platform E2E and CI, independent of features |
| PR #6 Electron indexed search tests | **Not verified** | no new GitHub Actions run visible for latest PR #6/7 head |
| Complete-branch CI and CodeQL | **Not verified** | run PR #7 head against `master` |
| Electron E2E of program search | **Not verified** | add/run acceptance with synthetic and authorized XMLTV |
| Real dataset EPG search relevance | **Not verified** | independent human labels for currently airing, upcoming, matchups, negatives, source binding |
| EPG full-index completeness | **Open** | sparse result pages repaired, but full FTS pages can still hide unindexed legacy rows |
| J3 playback and J4 search journeys | **Not verified** | run `pnpm run perf:journeys` on canonical Linux CI runner and preserve summary |
| Electron Windows MPV packaging | **External blocker** | pinned runtime archive returns HTTP 404; address separately |
| Required local review gate | **Not verified** | Codex + Greptile CLI on committed branch per `AGENTS.md` |

### Local and Linux CI validation commands

Use `.nvmrc` and the repository's pnpm, and install the frozen lockfile before all checks:

```sh
pnpm install --frozen-lockfile
pnpm nx test epg-data-access
pnpm nx test playlist-m3u-feature-player
pnpm nx test ui-epg
pnpm nx test electron-backend --runInBand
pnpm run typecheck:ci
pnpm run typecheck:spec
pnpm nx lint epg-data-access
pnpm nx lint playlist-m3u-feature-player
pnpm nx lint ui-epg
pnpm nx lint electron-backend
pnpm run release:notes:validate
pnpm run perf:journeys
```

Use the output and summary from the **same commit** before making readiness claims. The synthetic search corpus is a unit fixture, not proof of live provider coverage, stream quality or sports broadcasting rights. Do not move performance ratchets without canonical Linux evidence.

### Operational safety

The main process can temporarily disable indexed/live-first EPG search via `IPTVNATOR_EPG_SEARCH_LEGACY=1` before launch. This reverts to oldest-first bounded literal search without changing stored data or playback. The kill switch is temporary, planned for removal within two releases.

Never represent `epg-candidate` as a playable channel. Keep source/channel identity separate, prevent network requests to unapproved services, preserve playback connections and do not expose credentials in logs.

### Remaining architectural decisions

- Full historical FTS5 rebuild and a trusted completeness marker should run **off the main rendering/IPC critical path**, with migration tests for 0.19–0.24 database snapshots and repeated startup.
- Search ranking should accept a provider-clock `now` if the user's EPG offset is nonzero; current backend ordering uses UTC wall time, while the renderer live filters use corrected provider time.
- The sports schedule adapter requires a real licensed/authorized, cached connector, freshness checks, verified alias IDs, and a user-facing evidence state.
- A unified sports screen and voice control should follow these release gates, not precede them.
