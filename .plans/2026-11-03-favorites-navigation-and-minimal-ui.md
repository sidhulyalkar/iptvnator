# Live TV frontend: favorites, provenance and minimal UI

## Direction
Reuse one persistent player, one canonical channel row, and the shared
navigation rail. Global Favorites combines M3U, Xtream and Stalker; playlist
favorites use existing local routes and stores. Never show guide data as proof
of playable media, or duplicate provider authentication and recovery.

## This slice
- Show M3U's existing playlist Favorites route in the contextual rail.
- Identify cross-provider Favorites/Recent rows by safe playlist provenance.
- Name favorite toggles using both channel and source while retaining
  `aria-pressed`; preserve favorite actions in narrow lists.
- Respect reduced motion and existing theme/selection tokens.

## Follow-up separate work
1. Qualify stacked PRs #1–#9 with current-commit CI and E2E.
2. Use existing playback ownership tokens for truthful loading, playing and
   recoverable error states across M3U, Xtream and Stalker.
3. Only introduce an in-player favorite action after verifying provider
   identity, capability and persistent favorite toggling contracts.
4. Validate 320/375/768/1440px light/dark, keyboard, screen readers, and
   touch before broad layout changes.
5. Measure selection-to-first-frame, favorite task completion, source-switch
   success, recovery success and layout stability before making comparative
   claims about other IPTV frontends.

## Gates
`pnpm nx test portal-shared-util` (discover exact target), affected UI tests,
web/spec typechecks, affected lint, translation drift and release-note
validation, relevant Electron E2E, plus mandated local Codex/Greptile review.
No player internals or provider authentication changes in this slice.
