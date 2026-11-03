---
type: feature
area: channels
---

The dedicated Stalker Live TV inline player now has a shared favorite control. Stalker favorite mutations report errors, with the player reconciling saved state before updating the star. Existing list hearts now update after the portal save callback instead of claiming instant success.

ITV and radio favorite removals now use a type-scoped storage path so colliding movie/series IDs are preserved. Ambiguous legacy records fail closed instead of deleting unrelated favorites.
