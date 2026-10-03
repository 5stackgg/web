import { ref } from "vue";
import { useRightSidebar } from "~/composables/useRightSidebar";

// How the hub dock tells "I want this app" from "I'm passing over it". Hover
// opens and switches apps, so the dock reads where the pointer is headed
// (menu-aim): an open hub switches the moment the pointer stops on an icon,
// except while the pointer is travelling toward the open card -- crossing other
// icons on the way there must not switch away from what you came for.
//
// Picked over two other prototyped variants: menu-aim plus a speed limit (felt
// sluggish) and direction-only, which held on any leftward move (too blunt).

// Rest on an icon before a closed hub opens.
const OPEN_SETTLE_MS = 120;
// An open hub switches as soon as the pointer stops crossing.
const SWITCH_SETTLE_MS = 0;
// Movement still counted as resting.
export const DOCK_TOLERANCE_PX = 8;
// How long a switch waits while the pointer heads for the card, and how far
// above and below the card's edge still counts as heading for it.
const AIM_HOLD_MS = 300;
const AIM_SLOP_PX = 40;
// The Chat icon sits on top of its own conversations: moving down to them
// mustn't flip to Chat on the way.
const CHAT_HOLD_MS = 220;
// A held switch is dropped if the pointer has moved on since.
const RETRY_DRIFT_PX = 12;
// How long the hub waits after the pointer leaves before closing.
export const DOCK_CLOSE_DELAY_MS = 250;

// Set by a click, cleared when the pointer leaves the hub: right after a
// click, switching needs the same rest as opening a closed hub.
const afterClick = ref(false);

// The settle time for the icon under the pointer right now.
export function dockSettleMs() {
  if (afterClick.value || !useRightSidebar().rightSidebarOpen.value) {
    return OPEN_SETTLE_MS;
  }
  return SWITCH_SETTLE_MS;
}

type Sample = { x: number; y: number; t: number };
const trail: Sample[] = [];
let tracking = false;

function trackPointer() {
  if (tracking || typeof window === "undefined") return;
  tracking = true;
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      trail.push({ x: event.clientX, y: event.clientY, t: performance.now() });
      while (trail.length > 12) trail.shift();
    },
    { passive: true },
  );
}

// Where the pointer was ~60ms ago and where it is now; null once it has been
// still for a beat -- a resting pointer aims at nothing.
function recentMotion() {
  const now = performance.now();
  const last = trail[trail.length - 1];
  if (!last || now - last.t > 60) return null;
  const from =
    [...trail].reverse().find((point) => last.t - point.t >= 40) ?? trail[0];
  if (!from || from === last) return null;
  return { from, to: last };
}

// Casts the pointer's direction of travel at the card's edge (the card sits
// left of the dock): landing on it, give or take the slop, means the pointer
// is on its way there.
function aimingAtCard(rect: DOMRect | null | undefined) {
  const motion = recentMotion();
  if (!rect || !motion) return false;
  const dx = motion.to.x - motion.from.x;
  const dy = motion.to.y - motion.from.y;
  if (dx >= -1) return false;
  const t = (rect.right - motion.from.x) / dx;
  if (t < 0) return false;
  const y = motion.from.y + t * dy;
  return y >= rect.top - AIM_SLOP_PX && y <= rect.bottom + AIM_SLOP_PX;
}

export function useDockIntent(cardRect: () => DOMRect | null | undefined) {
  const { rightSidebarOpen } = useRightSidebar();
  trackPointer();

  let pending: ReturnType<typeof setTimeout> | null = null;

  function holdAndRetry(delay: number, retry: () => void) {
    const at = trail[trail.length - 1];
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      const now = trail[trail.length - 1];
      if (at && now && Math.hypot(now.x - at.x, now.y - at.y) > RETRY_DRIFT_PX) {
        return;
      }
      retry();
    }, delay);
    return true;
  }

  // True when a switch should wait; it is retried a moment later if the
  // pointer stayed put, so stopping on an icon after all still gets you it.
  function shouldHold(target: string | undefined, retry: () => void) {
    if (!rightSidebarOpen.value) return false;
    if (target === "chat" && recentMotion()) {
      return holdAndRetry(CHAT_HOLD_MS, retry);
    }
    return aimingAtCard(cardRect()) ? holdAndRetry(AIM_HOLD_MS, retry) : false;
  }

  return {
    shouldHold,
    pointer: () => trail[trail.length - 1],
    noteClick: () => {
      afterClick.value = true;
    },
    clearClick: () => {
      afterClick.value = false;
    },
  };
}
