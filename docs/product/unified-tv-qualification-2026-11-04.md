# Unified TV qualification: draft integration checkpoint (2026-11-04)

**Not a release or a recommendation to merge into master.** This branch
contains the entire stacked UI/EPG/Favorites work through PR #16, the
independent PR #4 duplicate-import repair, and focused P0 fixes.

## Tested code boundary

- Original stacked head: `ed8dc4a447c32ca9b3e2bf73b02daafbb082a47d`.
- Qualification branch: `qualify/unified-tv-end-to-end-p0-20261104`.
- The main process issues an epoch when a renderer first uses the scoped
  player-header bridge. It accepts only strictly newer generations from the
  currently owning Electron sender. A superseded setup or release is rejected.
- A renderer timeout fences pending IPC with a higher generation and returns
  failure. Even an unusually late apply cannot resurrect the old credentials.
- Legacy unscoped playlist defaults remain supported but may not replace
  a newer scoped inline-stream lease.
- Stalker typed removals require matching `itv`/`radio` evidence. Legacy
  untyped removals are rejected when several entries share the same ID.

## Reproduce on a clean local checkout

Use the pinned Node and pnpm versions from `.nvmrc`/package.json.
Native packaging requires the OS-specific prerequisites documented in the repo.
Do not use real provider credentials in fixtures or logs.

```bash
git fetch origin qualify/unified-tv-end-to-end-p0-20261104
git switch --detach origin/qualify/unified-tv-end-to-end-p0-20261104
corepack enable
pnpm install --frozen-lockfile

pnpm nx test electron-backend --runInBand
pnpm nx test ui-playback
pnpm nx test services
pnpm nx test epg-data-access
pnpm nx test ui-epg
pnpm nx test playlist-m3u-feature-player
pnpm run typecheck:ci
pnpm run typecheck:spec
pnpm run release:notes:validate
pnpm nx e2e web-e2e
pnpm nx e2e electron-backend-e2e
pnpm run perf:journeys
```

Use `pnpm nx show projects` to verify project names before invoking them.

## Manual acceptance on an Electron build

Use three independently controlled, authorized synthetic IPTV sources with
colliding IDs and a separate fixture source that intentionally stalls. Do not
connect to unauthorized live IPTV services.

1. On each of M3U, Xtream, Stalker, select A, then B, then C before A
   resolves; C must remain selected and A/B must not flash, autoplay or
   install headers after completion.
2. Repeat with headers delayed past 15 seconds, a bridge rejection, an
   authentication failure and a rapid retry. UI must show a recoverable
   failure without leaking tokens to logs.
3. Favor and unfavor a committed live stream in each provider, restart,
   reopen another source, and confirm persistence stays source-scoped.
4. Create duplicate ID 42 in Stalker ITV, radio and VOD; untyped deletion
   must refuse the operation, typed ITV removal must leave the others.
5. Test player native/fullscreen modes; verify star visibility and keyboard
   accessibility, and test source removal while fullscreen.
6. Measure first frame and p50/p95 switching under a fixed synthetic lineup,
   preserving OS/runner/commit, media engine, fixtures and network shaping.

## Evidence rule

Record commit SHA, exact command, OS, Node/pnpm versions, test count and result,
workflow URLs, and any known skipped checks. Unit tests are not evidence of
real provider compatibility, DRM, subscription limits or platform packaging.

Release blockers still include real provider evidence, integration CI,
Electron E2E, Windows MPV archive availability, macOS x64 DMG packaging,
the historical FTS recall migration, and fully player-owned fullscreen
Favorites actions.

Do not merge the broad qualification PR as a replacement for the intended
stack unless explicitly reviewed and approved.
