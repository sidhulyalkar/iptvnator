---
type: fix
area: playback
---

An Electron stream whose request-header setup fails now shows the existing playback error and Retry action rather than an empty player. Rejected or thrown bridge operations no longer count as configured headers, and stale handoffs cannot replace a newer channel's recovery state.
