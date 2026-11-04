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

## See the interface locally

For a quick browser/UI inspection with the repository's synthetic Xtream
backend, launch the existing demo (not an Electron security test):

```bash
pnpm run serve:marketing-demo:web
```

Open the URL Nx prints. The synthetic backend is useful for visual discovery,
navigation, loading states and Favorites feedback. It is not evidence of
Stalker/M3U credentials or desktop IPC safety.

For a development Electron session, start the renderer and backend in
separate terminals from a clean installed checkout:

```bash
pnpm run serve:frontend
# separate terminal:
pnpm run serve:backend
```

Use only sources you own or are authorized to access. The live-player tests
should intentionally include delayed, failed and credential-free fixture URLs;
never paste provider secrets into a bug report. Browser PWA playback and
Electron playback exercise different capabilities, so qualify both.

## Verified isolated state-machine evidence

Recorded 2026-11-04: the Git blob SHA of
`apps/electron-backend/src/app/services/scoped-stream-header-lease.ts`
was `a5b9e5674e55ddbff91ac7b3a5fe9aa45cc98519`.
A clean TypeScript compile of that exact source using installed Node 22 and
`tsc --strict --target ES2022 --module commonjs --lib es2022,dom` passed.
An isolated Node test harness against the compiled controller passed 11/11
assertions, including 200 deterministic reordered-switch simulations, stale
release rejection, renderer crash/reload, and the irreversible legacy IPC
fallback guard. This harness is not the repository's Jest, Chromium, or
packaged Electron suite, and does not verify real playback.

A second isolated check compiled the exact
`libs/services/src/lib/stalker-favorite-scoped-remove.ts` Git blob
`2aad991bad852cae8633f1536e5088213423ebd3` with a local
`StalkerPortalItem` declaration stub, and passed **7/7 Node tests** for
typed ITV/radio removal, VOD collisions, numeric legacy ambiguity,
unique untyped removal, blank IDs, and immutability. This is not a
repository persistence or UI/E2E test.

The GitHub PR had **no recorded workflow runs** on its latest head at the
time of this evidence entry. Do not call the branch validated until the
repository's own Nx typecheck, lint, unit tests and E2E are successful on the
exact target commit. The runner/environment distinction is intentional.

## GitHub Actions: manual run if automatic checks do not appear

Existing workflow files already have `workflow_dispatch`. In GitHub Actions,
choose the qualification branch in **Run workflow** for:

- `CI` (lint, types, relevant units and release-note gate);
- `Cross-Platform E2E Tests` (Chromium + Electron shards);
- `Build and Make Electron App` (downloadable test packages where the build
  succeeds; Windows MPV 404/macOS x64 DMG failures are known blockers).

Do not interpret an empty check list as a pass. GitHub workflow runs initiated
from an unrelated branch or parent commit do not qualify this head. Record
artifact SHA and branch SHA before installing a test package.

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
