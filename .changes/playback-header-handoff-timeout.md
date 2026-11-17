---
type: fix
area: playback
---

Streams no longer wait indefinitely when the desktop request-header setup stalls. The player offers Retry, a superseded channel request stops waiting promptly, and a late response cannot reopen the old stream.
