# Minimal TV Guide search interface

The guide is a programme **discovery** surface, not a second IPTV player. It keeps the existing channel grid, date controls, source scope and playback ownership unchanged.

## Interaction contract

| Element | Primary task | Rules |
| --- | --- | --- |
| Filter channels | Narrow visible channel rows | Does not query EPG programmes |
| Search programmes | Find titles and EPG metadata | Optional only when host advertises programme search; debounce 300 ms, minimum 2 characters, 20 visible results |
| Search panel | Open programme details | Compact region anchored below wrapped toolbar, max viewport height; no auto-play, no invented channel availability |
| Result | Programme title, date, channel | Native button; Tab/Enter always work, optional Up/Down cycle through results |
| Unbound guide result | Show programme details only | Labelled **Guide listing only · Channel not in this list**; does not claim a playable channel |
| Escape | Return to field from results | Escape inside nonempty input clears it; empty input blurs so guide shortcut can close it |
| Changed source/scope | Reset discovery | Discard old query, old results and pending response; no cross-scope row IDs |
| Errors | Explain failure and offer Retry | Errors are never presented as zero results |
| Loading | Indicate active search | Displayed immediately during debounce and provider query; never pretend "No results" while loading |
| Empty | No matches reported by host | Only after a successful settled search |

The results container is a labelled region, **not** a fake listbox: the items are native buttons with browser focus behavior. Native Tab order is never captured. The panel is announced via status and alert regions, and the input has an explicit accessible label and relationship to the panel. Channel filter also has an accessible name.

## Visual budget

Keep one neutral search panel with no decorative badges or fake streaming indicators. Small type uses theme tokens and the app focus ring, not one-off brand colors. The panel is limited to 420 px on large layouts; on narrow screens it uses the available width with 44 px minimum result targets. The toolbar keeps its existing wrap and source controls; keyboard hints can scroll horizontally instead of clipping.

## Explicitly deferred

- Global cross-provider guide search: current results belong to the host; the optional M3U bridge is not a new Xtream/Stalker universal search.
- Voice/microphone button: no ASR provider or microphone permission has been integrated. Do not display a dummy control.
- Sports event / live source badges: EPG programme time is **not** confirmed stream availability. Do not imply active broadcasting rights.
- EPG index repairs and backend search ranking are separate draft PRs and must be qualified independently.

## Verification

Run focused UI EPG Jest tests, renderer/spec typechecks, UI lint and release note validation. The existing Electron guide E2E now exercises synthetic programme search, keyboard focus, a zero-result query and a preserved active channel. Test light/dark themes and viewport widths including 320, 375, 768 and 1440 px before merging. Use screen readers and keyboard-only traversal for the search surface, including empty and error states.

**The new code and tests are not proof of production readiness until current-commit CI and the repository review gate run.**
