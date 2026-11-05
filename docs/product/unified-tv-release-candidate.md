# Unified TV release-candidate checklist

Status recorded **2026-11-04**. This document describes a candidate, not a
published release. Never interpret a green web deployment as confirmation that
Electron or third-party providers work.

## Candidate, implementation and showcase

- Integration: [draft PR #17](https://github.com/sidhulyalkar/iptvnator/pull/17)
- Branch: `qualify/unified-tv-end-to-end-p0-20261104`
- Browser UI, last known green Angular build:
  https://iptvnator-unified-tv-preview-67wgzzln5.vercel.app
- Three-step showcase is an unindexed route at `/iptvnator/unified-tv-candidate/`
  in the *separate website preview project*; do not advertise the link until
  deployment and its server-rendered structural tests pass.
- Screenshot tour uses preexisting product screenshots, not captures from
  this candidate branch. This distinction is stated on the page.

## What qualifies as a release

| Gate | Required evidence | Recorded result |
| --- | --- | --- |
| App TypeScript | Renderer + Electron TS on exact commit | Passed on previous integration commit |
| Spec TypeScript | All 41 project spec configs | Passed on previous integration commit |
| Release notes | `pnpm run release:notes:validate` | Length violation repaired; recheck pending |
| Windows runtime | Fresh pin, verified SHA-256 and real package extraction | Pin updated from authenticated upstream GitHub release; extraction pending |
| Unit regressions | All targeted Electron, player, Favorites, EPG suites green | Partial results only; serial qualification rerun pending |
| Web/PWA | Production Angular build of exact release commit | Previous candidate green; exact-head build pending |
| User journeys | Search, Favorites, EPG, switching, empty/error states with synthetic fixtures | Not yet signed off |
| Electron E2E | Crash/cancel/auth scope; embedded playback, same URL and rapid switch | Not yet passed for this commit |
| Platform installers | Windows x64/ia32, macOS arm64/x64, Linux required targets | Not yet passed; macOS x64 DMG issue unresolved |
| Provider acceptance | Authorized opt-in testing; no credentials in artifacts | Not yet performed |
| Release review | PR reviewers and CI, no protected base regressions | GitHub Actions currently not triggering on branch |

**Stop conditions:** do not mark PR ready, tag a release, or merge if any
required gate is red or unexecuted.

## Local candidate qualification

```sh
git fetch origin
git switch qualify/unified-tv-end-to-end-p0-20261104
corepack enable
pnpm install --frozen-lockfile
node tools/qualification/run-unified-tv-gate.mjs
node --test tools/qualification/check-windows-pin.test.mjs
```

For native acceptance, separately run the repository's Electron/E2E/package
jobs on supported Windows, macOS and Linux runners. The main process scoped
header controller is a security boundary; a PWA does not exercise it.

## Demonstrate the simplest complete user journey

Use an explicitly licensed *synthetic* playlist and mock servers. Keep this
tour under a minute, with no real credentials or broadcaster branding:

1. **Find** a channel by name. Show a stable, readable list, keyboard
   search, and meaningful loading/empty/error states. Do not imply speed
   results unless measured.
2. **Decide** from the current and next program on the guide. Show the
   relationship between the selected row, actual mounted player and EPG;
   avoid concealing the TV context behind extra chrome.
3. **Keep** the current channel with a Favorite action, revisit it from the
   cross-source collection, then un-favorite it. Verify the saved mark only
   changes after persisted acknowledgment.

The interface should be a restrained media workspace: one primary player,
a clear navigation hierarchy, an obvious selected channel, and peripheral
actions that appear in context. Design for 390px, laptop and TV viewport;
keyboard, touch, focus visibility, color contrast and reduced-motion access
are non-negotiable.

Do not add a fake provider or a video loop to the tour. Capture real evidence
from the actual candidate and synthetic fixture sources only *after* its
end-to-end acceptance passes. Prefer three true screenshots and a short
captioned product recording to decorative motion.

## Release dependencies requiring explicit intervention

- GitHub Actions has no runs associated with the candidate branch despite
  committed workflow triggers. Inspect fork Actions permissions and invoke
  the branch qualification and packaging workflows on the exact head.
- The Windows LGPL MPV archive upstream rotates about every 30 days; update
  the pinned digest with the repository's existing refresh tool at least every
  14 days. A metadata freshness gate does **not** replace binary SHA-256,
  archive-layout, licensing review, and installer checks.
- The existing Electron builder configuration references the upstream
  `4gray/iptvnator` GitHub publish target. Release the fork only through an
  explicitly reviewed destination and signing/notarization setup.
