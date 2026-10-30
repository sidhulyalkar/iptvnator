# Unified TV: TV-first interface and accessibility contract

**Status:** proposed design, not implemented UI. The existing IPTVnator navigation and native playback ownership take priority.

## Navigation

- **For You:** continue watching, favorite live channels, recent sources, timely events; source readiness and guide freshness always visible when relevant.
- **Live Sports:** league/team selection, live and upcoming event times, sourced broadcaster claims and unverified-state labels.
- **My Shows:** canonical series and episodes across linked catalogs, one content tile with separate authorized viewing options.
- **Guide:** traditional timeline plus indexed program title, synopsis and date search.
- **Universal Search:** typing, remote keyboard, optional push-to-talk; preserve the editable recognized transcript and show matching evidence.

## Focus / playback requirements

Remote directional focus must be visible and stable. Focus alone never launches a stream. Enter selects, Back restores the previous surface without interrupting playback, and channel up/down act only in the owning live-player context. Existing desktop Ctrl/Cmd+F and Ctrl/Cmd+K shortcuts remain compatible. Mobile companion push-to-talk is optional; no always-on listening.

Independently loaded rails should show cached content promptly with per-rail loading states, not block the whole app. On errors distinguish network, codec, source unauthorized, and broadcaster unverified. Show 'Game found; channel not verified' instead of a Play affordance when a schedule/EPG join cannot confirm access.

## Acceptance scenarios

1. A user finds a show from episode, season, synopsis or air date without knowing its channel.
2. The phrase 'NFL' yields relevant events, while 'Packers vs Eagles' does not silently become a Packers–Panthers match.
3. Favorites influence browsing but do not outrank a different exact title.
4. IPTV and external offerings show under one canonical content title, but every provider has its own eligibility, region, and playback/deep-link action.
5. Everything operates without voice or an external watch-tracking account. Meet screen reader, remote-only, reduced-motion and 200% text-scale checks on actual hardware.
