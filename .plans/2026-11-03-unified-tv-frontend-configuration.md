# Unified TV Frontend: UX, Reliability and Configuration Plan

Status: implementation roadmap, not a claim of verified runtime behavior.
Parent work: draft PR #11 (header handoff recovery) → #10 (favorites) → #9 (guide UI) → underlying discovery stack.
Canonical implementation references: `docs/architecture/workspace-shell.md`,
`docs/architecture/iptvnator-ui-guidelines.md`,
`docs/architecture/embedded-inline-playback.md`,
`docs/architecture/player-controls-contract.md`,
`docs/product/unified-tv-guide-search-ui.md`, and
`docs/architecture/validation-map.md`.

## 1. Product contract and exclusions

Goal: make channel watching, switching, favoriting, programme discovery,
and error recovery simple, responsive, provable and consistent across M3U,
Xtream and Stalker without duplicating transport, source or navigation systems.

Non-goals for the initial release:
- Rewriting the Electron, Angular or Nx architecture.
- Background preconnecting multiple authenticated streams (providers can
  enforce one-connection limits and the scoped Electron header override is
  shared).
- Treating cached EPG rows as evidence that a stream will play.
- Automatically choosing an alternate playlist/provider after a stream failure.
- Claiming voice support before permissions, ASR, cancellation and privacy
  controls actually work.
- Introducing a second favorites database or changing historical identifiers.
- Replacing Angular Material's accessibility primitives merely for appearance.

## 2. Existing system and configuration owner

| Area | Existing owner | Default or configured policy |
| --- | --- | --- |
| Global navigation | WorkspaceShell + route-aware rails | Compact, icon-only with localized accessible names |
| Live selection | M3U and portal route-scoped stores | Last intentional source/session selection wins |
| Favorites | UnifiedFavoritesDataService, provider stores | Global cross-source collection; playlist-specific views |
| Recent | Shared collection/history confirmation | A URL resolution alone never qualifies as watched |
| Channel row | app-channel-list-item | One shared selected/favorite/EPG rendering contract |
| Guide search | ui-epg controller and capability-aware provider bridge | Explicit loading/empty/error; metadata-only results honest |
| Player engine | WebPlayerView, PlaybackRecoverySession, shared controls | Preserve engine, source and application identity tokens |
| Header handoff | ElectronStreamHeadersService | Fail closed, 15s bounded IPC, immediate supersession |
| Startup/preferences | SettingsStore and DEFAULT_SETTINGS | Existing defaults retained unless user opts in |
| Theme | m3-theme.scss and --app-* tokens | Separate intentional light/dark treatment; no glass overload |
| E2E and quality | Nx validation map, app and Electron E2E | Current-commit evidence required before ready/merge |

Do not add new persisted settings just because a capability is configurable.
A new preference needs a user-facing reason, normalization, storage, migration,
form state, translation parity and relevant tests. Existing user settings must
never be silently overwritten by a UI redesign.

## 3. Information architecture and responsive behavior

A. Persistent workspace tasks:
- Live TV: media is primary; channel/EPG sidebar is a subordinate, optional pane.
- Guide: time-axis and selected source/scope, channel rows and honest guide-only results.
- Search: one visually discoverable entry, but result types stay explicit
  (playable channel, programme listing, catalog VOD/series, metadata only).
- Library: global favorites and recent, playlist context, source availability.
- Sources and Settings stay persistent shortcuts; provider-specific Movies,
  Series and Radio live inside source-specific navigation.

B. Do not break existing routes:
- Global favorites: `/workspace/global-favorites`
- Global recently viewed: `/workspace/global-recent`
- Global indexed search: `/workspace/search` Electron-only today
- M3U collection: `/workspace/playlists/:id/favorites`
- Per-provider sections: `/workspace/xtreams/:id/...`,
  `/workspace/stalker/:id/...`
- Player/control state never depends on a route title or visible tab.

C. Responsive rules:
- Wide: stable compact rail, optional channel pane, dominant 16:9 player,
  a concise context line with programme and provider.
- Medium: preserve player first, allow channel panel to collapse.
- Phone (existing 640px shell switch): horizontal nav and modal context
  drawer with correct inert/focus trapping. Explicit single scroll owner.
- 320/375/768/1440px test matrix in both themes and 100/125/200% zoom.
- Search, star, Retry and source switch remain keyboard accessible and named.
- No extra fullscreen overlays while the user is simply watching.

## 4. Source capability matrix

| Capability | M3U | Xtream | Stalker |
| --- | --- | --- | --- |
| Favorite channel | Existing store | Existing database/provider store | Existing portal favorites |
| Global favorites | Yes, with playlist-qualified ID | Yes, same | Yes, same |
| Current programme | XMLTV if configured | Provider EPG or authorized XMLTV | Provider EPG when supported |
| Channel playback | Existing stream URL and headers | Resolve selected catalog item | Resolve selected portal command |
| Media success | Engine event evidence only | Engine event evidence only | Engine event evidence only |
| Offline/unavailable | Honest missing/unresolved state | Preserve unavailable saved favorite | Preserve saved favorite and report what is known |

Never turn an unavailable favorite into a fake playable row. Preserve identity
and safely expose why activation is disabled. Provider credentials, URLs and
playlist names containing secrets must never reach UI labels, error reports
or analytics.

## 5. Live session state model, evidence and ownership

The intended presentation model for later implementation is:

| Visible phase | Required evidence | Forbidden inference |
| --- | --- | --- |
| Selected | Current source+channel identity | Playable |
| Resolving | Provider request in progress | Connected |
| Preparing | Scoped headers accepted, engine remount pending | Playing |
| Buffering | Current engine reports loading/waiting | Video frames |
| Playing | Current engine confirms actual media playback | Success from URL alone |
| Recovering | Current engine reports a recoverable stall | Terminal failure |
| Failed | Owned, terminal diagnostic or finite handoff timeout | Failure from previous channel |
| Ended | Current finite media ended | Live stream ended on a stale event |

Only the component currently owning the application/session token can update
playback, history or visible diagnostics. New source selection revokes the
previous token before awaiting IPC. On rapid A→B→C, C is the only valid
commit owner; old callbacks are ignored, including errors after cancellation.

A 15s timeout belongs to Electron **header IPC**, not to stream resolution or
time-to-first-frame. Do not treat it as an engine stall timer. PWA has no
Electron header stage. After any header IPC false/reject/timeout, show the
existing retryable diagnostic and never mount a credential-gated source as
though headers were configured. Timeouts do not cancel main-process IPC;
review main-process serial ordering separately before broad concurrent streams.

## 6. Favorites and library interaction

- One star per channel row; accessible name includes channel/source, and
  `aria-pressed` persists across selection changes.
- A future in-player star must invoke the same provider-specific persistence
  action, not mirror a separate local flag. Its active channel identity must
  be scoped by source + playlist + provider item ID.
- Favoriting must be resilient to repeated rapid clicks, offline write errors,
  duplicate names, catalog refresh, stale IDs, and deleted playlists.
- Optimistic presentation only when a deterministic rollback and honest save
  error exists; otherwise show a pending state.
- Recently viewed and favorites remain separate concepts.
- Avoid storing raw channel URLs as analytics identifiers. Stored M3U legacy
  favorite IDs retain historical compatibility; migrate only with evidence.

## 7. EPG, search and voice

- Search channels quickly via existing scoped catalogs or local loaded lists.
- Programme search remains capability-dependent, 300ms debounce, 2+ chars,
  bounded results, retry/error/empty differentiated, stale results rejected.
- Mark programme-only hits as **guide information only**, not playable.
- Do not initiate a playback just by focusing a search result.
- Voice search is a later, opt-in push-to-talk path with real microphone
  permissions, transcription provenance, user confirmation and cancellations.
- Do not persist microphone audio, search tokens or credentials by default.

## 8. Visual system and interaction hierarchy

Use the existing theme boundary:
- Dark: near-black player stage, restrained raised panel, one selection accent.
- Light: lighter, flatter surfaces, same semantic selection and focus pattern.
- Keep body/selection surfaces from `--app-*` tokens; no hardcoded cyan
  theme rewrite, full-screen masks or permanent shadows.
- Prefer hierarchy: channel name → current programme → time/status → source,
  with actions aligned in stable fixed-size slots.
- Display no invented bitrate/health/availability badges. EPG time must honor
  the configured display-only offset and clear no-data states.
- Keep 44px practical touch targets where space permits; compact density
  must not hide the last remaining favorite action.
- Reduced-motion removes decorative movement without suppressing functional
  feedback. Avoid compositing masks on scrollers.

## 9. Staged PRs and proof

P0. Qualify #1–#11: release-note schema, TypeScript, lint, component tests,
Electron E2E, translation drift, and required local Codex + Greptile reviews.
Current draft GitHub PRs have not shown current-head CI evidence.

P0. This PR: bounded scoped-header IPC; superseded waiters settle false;
unit tests for timeout, old→new, clear, no late success, preservation of PWA
behavior. This does not promise end-to-end source readiness.

P1. Add session-aware **presentational** playback phases from real engine and
provider signals, with exact owner-token tests and explicit unknown states.
Never merge loading with success.

P1. Implement active-player favorites only after mapping source IDs through
the existing shared favorites data access and testing all 3 providers.
Progress: the Recently Viewed live player covers the unified collection, and
Xtream dedicated live playback now has a source-scoped persistence adapter
using the existing Xtream favorite store and cross-panel relay. The shared
favorite button is presentation-only; an unavailable persisted-state read
offers read-only Retry. The M3U video player now uses the same playlist-scoped NgRx action and
favorites URL list as its rail, preserving the existing optimistic write
semantics. Stalker has a source-owned committed-playback adapter that checks
persisted favorites on load and after store success callbacks; store failures
are observable, stale sources cannot update the player, and row marks only
change after successful portal writes. All are unverified until Nx/E2E runs.
Radio and external/fullscreen variations still need a separate review.

P1. Unify channel/guide discovery affordances in the current workspace shell
without creating another route or duplicating query execution.

P2. Minimal visual refinement: active selection, stable metadata slots,
compact contextual actions, responsive mode, keyboard and focus.

P2. Optional voice interface only when real ASR and permission flow exist.

P3. Evaluate UX through task-level experiments, not product claims.

Required commands (after clean `pnpm install --frozen-lockfile`):
```bash
pnpm nx test ui-playback
pnpm nx lint ui-playback
pnpm nx test portal-shared-util
pnpm run typecheck:web
pnpm run typecheck:spec
pnpm run release:notes:validate
pnpm run styles:icon-ligatures:validate
```
Also run affected Electron playback/radio/collection E2E, light/dark
responsive checks, accessibility and the repository review gates.
Because the currently stacked PRs target feature branches, the CI workflow's
master-only PR filter may not run automatically. Use documented manual
workflow dispatch from the GitHub CLI and match run SHA before accepting it.

## 10. Evaluation scorecard

Measure on reproducible M3U, Xtream, Stalker fixtures:
- Time from user channel selection to first frame (p50/p95); not only URL resolution.
- Wrong-channel frames or stale diagnostic events (target: zero).
- Header IPC timed out/rejected/superseded counts, without URL-bearing logs.
- Favorite add/remove accuracy and post-restart durability.
- Time-to-favorite and time-to-find programme.
- Correct empty vs error classification and keyboard journey completion.
- Source-switch A→B→C correctness, one-connection provider protection.
- UI long-task, dropped-frame, content-shift and compositing budgets.

Capture baselines first. Do not publish speed, quality, or competitor advantage
claims from aspirational targets. Any performance change follows the existing
journey ratchet and feature-switch policies.
