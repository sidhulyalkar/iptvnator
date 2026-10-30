# Unified TV: architecture contract

**Status:** design only. Sprint 0 changes no production playback, persistence, or UI behavior. Existing source adapters, playback-session keys, EPG mapping, data migrations, and the performance-ratchet system remain authoritative. See the repository's architecture documents on embedded-inline-playback, m3u-playlist-module, performance-journeys and tv-application.

## Separate identity from availability

A canonical ContentItem represents an episode, program, movie, series, or sports event independent of where it is watched. An Airing represents an actual scheduled window, carrying a source, fetched-at timestamp, UTC start/end and confidence. A Channel is keyed by (sourceId, provider kind, providerChannelId) rather than mutable playback URL or shared EPG name. An external ViewingOption or IPTV ViewingOption connects that content to an eligible source with a separate, time-sensitive availability state.

```text
ContentItem
  +-- external identifiers, aliases, provenance
  +-- Airing(startUtc, endUtc, source, confidence)
  |     +-- Channel(sourceId, providerChannelId, tvgId?)
  |             +-- Source(M3U | Xtream | Stalker)
  +-- ViewingOption(source, territory, checkedAt, status)
  +-- ExternalOffer(provider, attribution, deepLink?)
```

A matching tvg-id across providers does not imply that two distinct channel records can share credentials, resolved media, or playback identity. Deduplicate content only when schedule and metadata evidence support the match; retain every independent source choice and conflicts with provenance.

## Search contract

Input is query, injected reference time, explicit device time zone, source inventory and optional entity/genre/date filters. First retrieve via exact title, alias and tokenized FTS; then enforce hard constraints (teams, dates, source eligibility), deduplicate canonical content and rerank by verified availability, live state, exactness and user choices. Personal history never overrides an exact-match hard constraint. Optional embeddings and voice parsing are later adapters, outside the video playback path.

Return match evidence, confidence, index freshness and all viewing options. Distinguish UNKNOWN, METADATA_MAPPED, PREFLIGHT_CHECKED, FIRST_FRAME_VERIFIED and UNAVAILABLE. Neither EPG data nor an HTTP 200 response establishes playable video. If a sports schedule contradicts guide data, return unverified mapping rather than inventing a live channel.

Start with SQLite FTS5 after reviewing the existing database/migration constraints. Benchmark cold and warm search, top-1, recall@5, MRR@5, false positives on unmatched queries, identity collisions and provider-specific slices. The synthetic evaluation tool is an independent research baseline, **not** the shipping search engine.

## Readiness / recovery

Default to **zero additional background video connections**, especially when provider concurrency limits are unknown. Catalog, guide and auth readiness are distinct from segment prebuffering. Perform provider-supported, authorized checks only. Resolve expiring URLs freshly; discard stale async completions; cap retries/backoff; recover without replacing a working stream unless the new one is actually ready and simultaneous sessions are permitted.

Use explicit state transitions: catalog_ready, source_resolving, connecting, playing, stalled, recovering, unavailable, cancelled. For performance measure click-to-first-frame and rebuffer events, not just manifests or socket establishment. Use redacted telemetry and never log tokens, signed URLs, voice audio or protected media.

## Dependencies and implementation order

Sprint 1: canonical types, shadow projection and index for M3U/XMLTV before portal EPG; read-only shadow evaluation, no migrations without existing historical schema tests. Sprint 2: provider-safe readiness/recovery with existing J3 controls. Sprint 3: sport schedule joins, aliases and regional broadcast validation. Sprint 4: push-to-talk, show watchlists, permitted deep links and accessibility across desktop/TV.

Initial performance targets are hypotheses, not measured outcomes: cached FTS p95 below 150 ms, voice-to-results p95 below 2 seconds on profiled hardware and event top-3 above 95% on independently annotated examples. Do not claim any without reproducible provenance and before/after evidence.

External services only through authorized discovery, watchlist or deep-link facilities. Never scrape credentials, bypass DRM or redistribute protected streams.
