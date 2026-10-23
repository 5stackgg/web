import { ref } from "vue";

const PINS_KEY = "5stack:nav-pins";
const FOLDED_KEY = "5stack:nav-folded";

function read<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and full storage keep the choice for this visit only.
  }
}

// Pins and folds are this browser's, not the account's. Folds record the
// sections that were shut, so a section added later starts open.
const pins = ref<string[]>(
  typeof window === "undefined" ? [] : read<string[]>(PINS_KEY, []),
);
const folded = ref<Record<string, true>>(
  typeof window === "undefined" ? {} : read(FOLDED_KEY, {}),
);
// The page just pinned, for a moment, so its new row and star can mark it.
const lastPinned = ref<string | null>(null);
let lastPinnedTimer: ReturnType<typeof setTimeout> | undefined;

export function useLeftNavState() {
  const isPinned = (key: string) => pins.value.includes(key);

  function togglePin(key: string) {
    const pinning = !isPinned(key);
    pins.value = pinning
      ? [...pins.value, key]
      : pins.value.filter((pinned) => pinned !== key);
    write(PINS_KEY, pins.value);
    clearTimeout(lastPinnedTimer);
    lastPinned.value = pinning ? key : null;
    if (pinning) {
      lastPinnedTimer = setTimeout(() => (lastPinned.value = null), 400);
    }
  }

  // Drops a pin before or after another one (drag to reorder).
  function movePin(key: string, target: string, place: "before" | "after") {
    if (key === target || !isPinned(key) || !isPinned(target)) {
      return;
    }
    const next = pins.value.filter((pinned) => pinned !== key);
    const at = next.indexOf(target) + (place === "after" ? 1 : 0);
    next.splice(at, 0, key);
    pins.value = next;
    write(PINS_KEY, next);
  }

  const isOpen = (section: string) => !folded.value[section];

  function setOpen(section: string, open: boolean) {
    if (isOpen(section) === open) {
      return;
    }
    const next = { ...folded.value };
    if (open) {
      delete next[section];
    } else {
      next[section] = true;
    }
    folded.value = next;
    write(FOLDED_KEY, next);
  }

  return { pins, lastPinned, isPinned, togglePin, movePin, isOpen, setOpen };
}
