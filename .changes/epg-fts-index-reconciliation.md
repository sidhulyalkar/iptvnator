---
type: fix
area: epg
---

Guide searches preserve older programmes when their full-text index is incomplete. After a successful guide refresh, the background EPG worker can verify and repair the search index without rebuilding it during a search.
