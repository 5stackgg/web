import { ref, watch } from "vue";

// How the hub dock's chat shortcuts behave, kept per browser on purpose: dock
// space depends on the screen, so a laptop and a big monitor want different
// limits, and nothing here needs to follow the player between devices.
//
// - maxPeople / maxRooms: how many direct conversations and how many rooms
//   (team, tournament, organizer chats) the dock shows at most.
// - pinned: always on the dock, whatever the activity.
// - dismissed: taken off the dock until the conversation has something newer
//   than the moment it was dismissed.
// - hidden: never on the dock until shown again.

const STORAGE_KEY = "hub-dock-shortcuts";

export const DOCK_SHORTCUT_LIMIT_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

type DockShortcutPrefs = {
  maxPeople: number;
  maxRooms: number;
  pinned: string[];
  dismissed: Record<string, number>;
  hidden: string[];
};

const DEFAULTS: DockShortcutPrefs = {
  maxPeople: 3,
  maxRooms: 2,
  pinned: [],
  dismissed: {},
  hidden: [],
};

function read(): DockShortcutPrefs {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    return { ...DEFAULTS, ...(stored ?? {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

const prefs = ref<DockShortcutPrefs>(read());

watch(
  prefs,
  (value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // A blocked store only means the choice lasts for this visit.
    }
  },
  { deep: true },
);

export function useDockShortcutPrefs() {
  function setLimit(kind: "people" | "rooms", value: number) {
    if (kind === "people") prefs.value.maxPeople = value;
    else prefs.value.maxRooms = value;
  }

  function isPinned(id: string) {
    return prefs.value.pinned.includes(id);
  }

  function togglePin(id: string) {
    prefs.value.pinned = isPinned(id)
      ? prefs.value.pinned.filter((pinned) => pinned !== id)
      : [...prefs.value.pinned, id];
    delete prefs.value.dismissed[id];
  }

  function dismiss(id: string) {
    prefs.value.pinned = prefs.value.pinned.filter((pinned) => pinned !== id);
    prefs.value.dismissed[id] = Date.now();
  }

  function hide(id: string) {
    prefs.value.pinned = prefs.value.pinned.filter((pinned) => pinned !== id);
    delete prefs.value.dismissed[id];
    if (!prefs.value.hidden.includes(id)) {
      prefs.value.hidden = [...prefs.value.hidden, id];
    }
  }

  function isHidden(id: string) {
    return prefs.value.hidden.includes(id);
  }

  function unhide(id: string) {
    prefs.value.hidden = prefs.value.hidden.filter((hidden) => hidden !== id);
  }

  function showHidden() {
    prefs.value.hidden = [];
  }

  return {
    prefs,
    setLimit,
    isPinned,
    togglePin,
    dismiss,
    hide,
    isHidden,
    unhide,
    showHidden,
  };
}
