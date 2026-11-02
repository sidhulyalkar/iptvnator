# Sprint 1 shadow index (draft)

Stacked on Sprint 0 PR #1. No production code, migration or UI change.

Delivered: FTS5 search over programs, aliases, descriptions, league, episode and date fields; explicit source/channel and verified-content identity; source-scoped atomic refresh with stale-row cleanup; safe bound queries; unknown playback status and synthetic regression suite.

Release gates pending: pinned-runtime CI, existing Nx/Electron test and performance journeys, local Codex/Greptile review, and independently annotated real EPG corpus. Do not merge on synthetic scores alone. The shadow index is a prototype that should be reconciled with IPTVnator's existing EPG SQLite infrastructure, not blindly used as a competing production database.
