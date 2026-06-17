---
name: tooltip-mobile-touch
description: FiveStackToolTip (and StatLabel) tooltips on touch — why they never opened and how tap-to-toggle works
metadata:
  type: reference
---

reka-ui tooltips are hover/focus-only by design and never open on a tap: the trigger's `pointerdown` sets an internal `isPointerDown` flag that blocks `handleFocus`, and the follow-up `click` calls `onClose`. So on phones every `StatLabel` / `FiveStackToolTip` was dead.

Fix lives in `components/FiveStackToolTip.vue`: on coarse-pointer devices (`matchMedia('(hover: none)')`) it goes **controlled** — passes a boolean `:open` + `:disable-closing-trigger="true"`, toggles `open` from its own `@click`, and dismisses on an outside `pointerdown` (capture). On pointer devices it passes `:open="undefined"` so reka stays uncontrolled and native hover is untouched (`TooltipRoot` useVModel is passive when `open === undefined`). The root is wrapped in a `<span style="display:contents">` (ref `rootEl`) purely so the outside-tap handler can tell taps on the trigger from taps elsewhere; content is portalled out so tapping it also dismisses.

`side`/`align` stay typed `string` and are cast `as any` at `TooltipContent` (callers like `[[stat-acronym-tooltips]]` pass plain strings).
