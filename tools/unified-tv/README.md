# Unified TV: Sprint 0 synthetic qualification

This is a dependency-free, offline discovery research harness, **not** IPTVnator's production search implementation. Every fixture is synthetic. In particular, Packers–Panthers and Packers–Lions are fictional test schedule records, not assertions about real NFL broadcasts.

## Run

```sh
node --test tools/unified-tv/evaluate.test.mjs
node tools/unified-tv/evaluate.mjs
```

Fixtures: lineup.m3u and guide.xml provide five no-network channels and program guide rows, including a UTC-offset equivalence case. catalog.json contains normalized source samples of M3U, Xtream and Stalker identities (not raw Xtream/Stalker wire-format mocks). queries.json freezes sports, episode, synopsis, title, date, aliases and negative-match queries.

The CLI contrasts a deliberately weak channel-title-only **synthetic control** with a hand-built program-metadata reference. Neither baseline measures the existing IPTVnator app. Top-1, recall@5 and MRR@5 evaluate positive queries; false-positive rate evaluates negative queries. Even a perfect score on a tiny self-authored fixture is not evidence of production retrieval quality, latency, or generalization.

The clock is fixed at 2026-11-01T18:30:00Z. Playback status always remains unknown. All media URLs use example.invalid and are unusable.

## Real evaluation gate

After a full checkout and dependency installation, run the existing IPTVnator Electron journeys with `pnpm run perf:journeys` and record J1/J3/J4 run summaries separately. Never relabel this fixture report as J4 performance. Follow with independently labeled redacted XMLTV/provider examples, negative matchups, multilingual cases, and real first-frame measurements on authorized streams. Never commit subscription credentials, playable URLs, or watch history.
