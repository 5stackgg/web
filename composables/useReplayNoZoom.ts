import { onMounted, onBeforeUnmount } from "vue";

// Disable native browser zoom on the chromeless replay pages. The replay drives
// its own pinch/zoom for the map; native page zoom on top of it gets stuck and
// is hard to undo on a phone.
//
// The viewport meta covers Android (and is harmless elsewhere). iOS Safari /
// iOS Chrome (both WebKit) ignore `user-scalable=no`, so we also cancel the
// Safari-specific pinch `gesture*` events. The replay's own pinch-zoom is driven
// by pointer events, which are a separate stream and stay unaffected.
export function useReplayNoZoom() {
  useHead({
    meta: [
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
    ],
  });

  const prevent = (e: Event) => e.preventDefault();

  onMounted(() => {
    if (typeof document === "undefined") return;
    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    document.addEventListener("gestureend", prevent, { passive: false });
  });
  onBeforeUnmount(() => {
    document.removeEventListener("gesturestart", prevent);
    document.removeEventListener("gesturechange", prevent);
    document.removeEventListener("gestureend", prevent);
  });
}
