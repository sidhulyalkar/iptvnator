# Unified TV Sprint 0 foundation

Base: fork master at e480e842ffd62453efebc07c0aed549e312a0d9d.

## Definition of done

- [x] Review upstream scope, security conventions and existing performance harness without touching production behavior.
- [x] Write canonical content, viewing-option, stream-readiness and search architecture contracts.
- [x] Write TV-first UX and accessibility acceptance specification.
- [x] Add deterministic synthetic M3U, XMLTV, and normalized M3U/Xtream/Stalker source records.
- [x] Freeze sports team, league, title, description, date, episode and negative-intent queries.
- [x] Build a dependency-free reference search evaluation script and fixture invariants.
- [ ] Capture full checkout J1/J3/J4 timing and Nx test evidence (environment/CI-dependent).
- [ ] Complete repository's Codex and Greptile CLI local review gate where available.

## Research safety gates

No real subscription secrets or protected streams in fixtures. No automatic hidden video connections with unknown connection limits. Never equate an EPG match to confirmed playback. No external service DRM workaround. Synthetic-only scores must remain explicitly labeled and cannot replace real journey measurements.

## Next increment

Start with canonical content projections and a shadow index that preserve upstream playback identity, then validate the same test set through real metadata adapters. Compare actual J4 baselines before changing production search.
