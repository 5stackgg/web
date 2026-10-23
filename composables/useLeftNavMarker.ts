// The amber marker on the left nav's guide lines moves like the app's animated
// tabs: it sits on the current page, and when the page changes it glides there
// in one piece from where it was, sections apart or not.
const GLIDE_MS = 240;
const GLIDE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

let lastTop: number | null = null;

// Before the nav re-renders for a new page: where the marker is now.
export function rememberNavMarker() {
  const marker = document.querySelector<HTMLElement>("[data-nav-marker]");
  lastTop = marker ? marker.getBoundingClientRect().top : null;
}

// A marker that has just appeared on the current page glides in from there;
// with nothing to come from it fades in where it is.
export function glideNavMarker(marker: HTMLElement) {
  const from = lastTop;
  lastTop = null;
  if (
    typeof marker.animate !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  if (from === null) {
    marker.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 150,
      easing: "ease-out",
    });
    return;
  }
  const shift = from - marker.getBoundingClientRect().top;
  if (Math.abs(shift) < 0.5) {
    return;
  }
  marker.animate(
    [{ transform: `translateY(${shift}px)` }, { transform: "none" }],
    { duration: GLIDE_MS, easing: GLIDE_EASE },
  );
}
