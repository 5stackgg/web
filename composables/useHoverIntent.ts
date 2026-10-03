import { onBeforeUnmount } from "vue";

// Fires when the mouse settles on an element rather than passing over it:
// every `interval` ms it compares where the pointer is with where it was, and
// only once it has moved less than `sensitivity` px in that time does the
// callback run. Sweeping down a column of icons never trips it; resting on one
// does. Mouse only -- touch and pen have no hover to read intent from.
// `interval` may be a function when the right wait depends on context.
export function useHoverIntent(
  callback: () => void,
  {
    interval = 100,
    sensitivity = 7,
  }: { interval?: number | (() => number); sensitivity?: number } = {},
) {
  const settleMs = () =>
    typeof interval === "function" ? interval() : interval;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let x = 0;
  let y = 0;
  let lastX = 0;
  let lastY = 0;

  function clear() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function check() {
    if (Math.abs(x - lastX) + Math.abs(y - lastY) < sensitivity) {
      timer = null;
      callback();
      return;
    }
    lastX = x;
    lastY = y;
    timer = setTimeout(check, settleMs());
  }

  function onPointerEnter(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    x = lastX = event.clientX;
    y = lastY = event.clientY;
    clear();
    timer = setTimeout(check, settleMs());
  }

  function onPointerMove(event: PointerEvent) {
    x = event.clientX;
    y = event.clientY;
  }

  onBeforeUnmount(clear);

  return { onPointerEnter, onPointerMove, onPointerLeave: clear };
}
