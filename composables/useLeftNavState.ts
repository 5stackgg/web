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

export function useLeftNavState() {
  const isPinned = (key: string) => pins.value.includes(key);

  function togglePin(key: string) {
    pins.value = isPinned(key)
      ? pins.value.filter((pinned) => pinned !== key)
      : [...pins.value, key];
    write(PINS_KEY, pins.value);
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

  return { pins, isPinned, togglePin, isOpen, setOpen };
}
