// A short haptic tap, on the platforms that will give us one.
//
// Two mechanisms, because no single one covers both:
//
// - `navigator.vibrate` is the Vibration API. Android has it. iOS Safari does
//   not, and never has -- not in the browser and not in a standalone PWA -- so
//   on an iPhone this call is silently doing nothing at all.
//
// - Safari 17.4+ plays a haptic when a `<input type="checkbox" switch>` is
//   toggled. Clicking a hidden one is the standard way to reach iOS haptics
//   from the web, and it is frankly a hack: it depends on a side effect of a
//   control's appearance rather than on any API, and Apple could take it away.
//   It fails quietly if they do, which is the right failure for decoration.
//
// Nothing here throws or blocks. A missing haptic is not worth a broken
// gesture.
let iosSwitch: HTMLInputElement | null = null;

// Rendered but invisible. `display: none` takes the control out of the render
// tree, and an unrendered control is not toggled in the way that produces the
// haptic.
function ensureIosSwitch(): HTMLInputElement | null {
  if (iosSwitch) {
    return iosSwitch;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const element = document.createElement("input");

  element.type = "checkbox";
  element.setAttribute("switch", "");
  element.setAttribute("aria-hidden", "true");
  element.tabIndex = -1;
  element.style.cssText =
    "position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;pointer-events:none";

  document.body.appendChild(element);
  iosSwitch = element;

  return element;
}

export function hapticTap() {
  // Must stay inside the gesture that asked for it. Both mechanisms need
  // transient user activation, which a long-press timer is still within.
  if (navigator.vibrate?.(10)) {
    return;
  }

  ensureIosSwitch()?.click();
}
