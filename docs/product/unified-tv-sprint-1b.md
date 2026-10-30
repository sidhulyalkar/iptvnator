# Sprint 1b: Real XMLTV discovery through the existing EPG bridge

This increment connects the M3U guide's existing program search UI to a query adapter that calls `EpgRuntimeBridgeService.searchPrograms`. It does not create a second production database, import schedule APIs, modify playback, or infer provider availability.

The adapter strips limited spoken-command words and matchup separators, then uses IPTVnator's existing indexed EPG retrieval. Time-qualified queries filter by the caller-supplied **provider-clock** time via `epgProviderClockMs`; malformed guide intervals are excluded. Plain queries continue to call the bridge once with the original input and limit.

The guide controller now uses monotonically increasing request generations: an older request cannot overwrite a newer one even if the user types the same query again. Destruction and clearing the field also invalidate pending responses.

Limitations: an EPG with only “Packers vs Panthers” and no NFL metadata cannot be found by “NFL” until a separately verified sports-event schedule adapter is implemented. An EPG result is not an authenticated channel or proof of playback. The guide still only allows activation when it can resolve an exact channel row. This increment does not yet unify external services.

Validation: `pnpm nx test epg-data-access`, the M3U feature-player project tests, EPG guide UI tests, typecheck and the existing J3/J4 performance journeys. The tool-only shadow index remains separate until we can justify reconciling it with the existing SQLite EPG index.
