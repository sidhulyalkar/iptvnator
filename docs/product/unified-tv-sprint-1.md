# Sprint 1: SQLite program discovery shadow index

This is **independent prototype tooling**, not a production search migration or player modification. IPTVnator already implements SQLite-backed EPG-program search and provider-specific playback. The shadow index is designed to validate canonical identities and cross-provider viewing options before adapting existing EPG APIs.

Run on the pinned Node runtime, offline:

\`\`\`sh
node --test tools/unified-tv/*.test.mjs
\`\`\`

Import normalized source data with \`replaceSource(sourceId,provider,rows,{complete:true,expectedCount:rows.length})\` only after a complete import; failed/incomplete imports cannot erase healthy indexed rows. Source-specific records are never merged by their title or EPG ID. Only explicitly verified canonical IDs allow grouping options, and every returned option has \`playbackStatus:'unknown'\`. No stream URLs or credentials are stored.

The fixed fixture sports games are **fictional**, not real schedules. A perfect toy-corpus result does not demonstrate generalization. Synchronous Node SQLite must remain off the UI thread. This module is not connected to the production EPG parser, guide, search UI, provider authentication, or player.

Next gate: compare read-only queries against current \`EpgRuntimeBridgeService.searchPrograms\`, qualify with authorized redacted XMLTV data, and run the established Electron J4 search and J3 playback journeys before changing behavior.
