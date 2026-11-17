# Sprint 0 validation register

Fork baseline: master commit **e480e842ffd62453efebc07c0aed549e312a0d9d** on 2026-10-29. The repository already has launch J1, playback J3 and search J4 performance journeys, their own mock fixtures and ratcheted thresholds. Do not modify upstream's tools/performance/journey-baselines.json without canonical Linux CI measurement evidence.

| Gate | Status |
| --- | --- |
| Fork writable, upstream source and architecture inspected | Verified via connected GitHub |
| No-credential M3U/XMLTV + normalized M3U/Xtream/Stalker fixtures | Included |
| Offline query corpus with positives/negatives | Included |
| Dependency-free synthetic fixture checks | Run locally with Node 22; report output in PR |
| Synthetic reference comparison | Run locally; does not measure product search |
| J1 launch, J3 first-playing, J4 real global search | **Not measured on fork** |
| Full Nx unit, lint, typecheck and Electron E2E | **Not run** in isolated environment without checkout/dependencies |
| Real provider concurrent connection and playback reliability | **Not measured** |
| New frontend/voice features | Not in Sprint 0 |

Once the full repository checkout is available, use .nvmrc Node, the pinned pnpm version and frozen lockfile install, then run `pnpm nx show projects`, `pnpm run typecheck:ci`, `pnpm run test:unit:ci`, and `pnpm run perf:journeys`. Store OS/hardware, commit SHA, CI run link, iterations, p50/p95 and failure reasons. Missing CI or a skipped benchmark is not a pass.

The fixture corpus is deliberately very small. A perfect fixture score is a test of the reference and its expected outcomes, not proof of a model's generalization or a usable production search index. Expand to independently annotated authorized/redacted mixed-provider EPG before making performance claims.
