# Sprint 2: Sports-event resolution and EPG evidence

**Status:** opt-in event matcher plus an immediate M3U guide-search correction. Stacked on PR #3. The player, authentication, source persistence and provider stream concurrency are untouched.

The existing Electron `EPG_DB_SEARCH_PROGRAMS` endpoint uses a literal `LIKE '%query%'` search, despite its historical FTS comment. A natural-language matchup such as "watch Packers n Panthers game" previously became "Packers Panthers" and missed programmes titled "Packers vs Panthers". The discovery adapter now retrieves one team name through the existing bounded EPG endpoint, then validates **both** team names in the programme title; unrelated opponents are excluded. A guide result is still just metadata.

A separate, optional sports feed may be registered through `SPORTS_SCHEDULE_SOURCE`. This branch registers **no external provider by default**. Given a recent trusted snapshot, league-name/alias queries select dated events and reconcile them to EPG candidates. It uses only provider schedule IDs, named team aliases, fresh UTC instants, EPG titles, and explicit time-window comparisons. Provider display correction applies only to raw EPG timestamps, not official schedule time.

TheSportsDB v1 response normalization is provided for a future authorized connector. It requires an explicit timezone, unique event ID, league and two distinct team IDs, and optional **ID-keyed** league/team aliases. It does not contact the API, assume NFL IDs, or invent broadcast rights. TheSportsDB's free API has restricted endpoints and rate limits; follow official docs, terms, attribution, caching and key storage before enabling network access.

Failure behavior: stale snapshots, invalid dates, missing teams and unsupported candidates return no schedule-backed result. If the optional feed fails, ordinary EPG text search remains available. A kickoff/channel match has status `epg-candidate` and **never** means confirmed playability. We deliberately do not infer a stream URL, check external rights, start video or create hidden buffering sessions.

Validation: targeted epg-data-access/M3U/guide test suite, renderer and spec TypeScript checks, lint, existing J3/J4 performance journeys and independent authorized-data acceptance. Synthetic Packers–Panthers fixtures are not assertions about actual NFL schedules.

## Next production milestone

Configure a vetted provider adapter with explicit permission and bounded caching, expose separate **event found / EPG candidate / channel verified / playing** states in the sports UI, and reconcile schedule updates against the existing IPTV source identity model. Preserve the current video player unchanged.
