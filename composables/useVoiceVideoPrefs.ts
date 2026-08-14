import { ref, watch } from "vue";

// Who you want to see, and whether you want to see yourself.
//
// The audio equivalent lives in useVoicePeerAudio and belongs to the listener
// rather than the channel; the same is true here. Turning someone's camera off
// on your end is not muting them -- you may well still want to hear them -- and
// the two controls being one was the reason there was no way to do it.
//
// Hiding a peer is not cosmetic: useVoiceChat drops their subscription, so a
// hidden camera stops costing bandwidth and decode as well as screen space.

const STORAGE_KEY = "5stack:voice:video";

type Stored = {
  // Steam ids whose camera this listener does not want rendered.
  hidden: Array<string>;
  // Whether to render your own camera back to yourself in a call.
  //
  // Off by default, and deliberately so. Watching yourself is a distraction
  // during a match, it costs a decode for a picture you already know, and every
  // other tile is someone you actually need to look at. The one place a self
  // view is the point is setting a camera up for a match that requires one --
  // that surface has its own preview and does not read this.
  showSelf: boolean;
};

const DEFAULTS: Stored = { hidden: [], showSelf: false };

function read(): Stored {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULTS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULTS };
    }

    return {
      hidden: Array.isArray(parsed.hidden)
        ? parsed.hidden.filter((id: unknown) => typeof id === "string")
        : [],
      showSelf: parsed.showSelf === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

const stored = ref<Stored>(read());

watch(
  stored,
  (next) => {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing -- the choice just won't survive the tab.
    }
  },
  { deep: true },
);

export function useVoiceVideoPrefs() {
  function isHidden(steamId: string) {
    return stored.value.hidden.includes(steamId);
  }

  function toggleHidden(steamId: string) {
    stored.value = {
      ...stored.value,
      hidden: isHidden(steamId)
        ? stored.value.hidden.filter((id) => id !== steamId)
        : [...stored.value.hidden, steamId],
    };
  }

  function toggleShowSelf() {
    stored.value = { ...stored.value, showSelf: !stored.value.showSelf };
  }

  return {
    prefs: stored,
    isHidden,
    toggleHidden,
    toggleShowSelf,
  };
}
