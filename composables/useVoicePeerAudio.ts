import { ref, watch } from "vue";

// How loud each other player is, and who has been silenced -- kept here rather
// than inside a session because it belongs to the listener, not to the channel.
// The same teammate is the same teammate in a party lobby, a match and a draft
// room, so turning them down once should hold everywhere and survive a rejoin.
//
// Applied straight to the <audio> element each peer is played through, so a
// change lands on a live call without touching the peer connection.

const STORAGE_KEY = "5stack:voice:peers";

export type PeerAudio = {
  // 0..1. HTMLMediaElement caps at 1, so this attenuates rather than boosts.
  volume: number;
  muted: boolean;
};

const DEFAULT_PEER: PeerAudio = { volume: 1, muted: false };

function read(): Record<string, PeerAudio> {
  if (typeof localStorage === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    // Anything hand-edited or written by an older shape is dropped rather than
    // trusted: a bad volume here is silence nobody can explain.
    const clean: Record<string, PeerAudio> = {};

    for (const [steamId, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      const entry = value as Partial<PeerAudio>;
      const volume = Number(entry?.volume);

      clean[steamId] = {
        volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
        muted: !!entry?.muted,
      };
    }

    return clean;
  } catch {
    return {};
  }
}

const peers = ref<Record<string, PeerAudio>>(read());

watch(
  peers,
  (next) => {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      // Defaults are not worth storing; only what the listener actually changed.
      const trimmed = Object.fromEntries(
        Object.entries(next).filter(
          ([, value]) => value.muted || value.volume !== 1,
        ),
      );

      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Private browsing -- the choice just won't survive the tab.
    }
  },
  { deep: true },
);

export function useVoicePeerAudio() {
  function settingsFor(steamId: string): PeerAudio {
    return peers.value[steamId] ?? DEFAULT_PEER;
  }

  function update(steamId: string, patch: Partial<PeerAudio>) {
    peers.value = {
      ...peers.value,
      [steamId]: { ...settingsFor(steamId), ...patch },
    };
  }

  function setVolume(steamId: string, volume: number) {
    update(steamId, { volume: Math.min(1, Math.max(0, volume)) });
  }

  function setMuted(steamId: string, muted: boolean) {
    update(steamId, { muted });
  }

  function toggleMuted(steamId: string) {
    setMuted(steamId, !settingsFor(steamId).muted);
  }

  function reset(steamId: string) {
    const { [steamId]: _dropped, ...rest } = peers.value;
    peers.value = rest;
  }

  // What the <audio> element for this peer should be doing right now. Muting by
  // element rather than by dropping the subscription keeps the peer connection
  // -- and the speaking indicator -- alive while they are silenced.
  function apply(steamId: string, audio: HTMLAudioElement) {
    const { volume, muted } = settingsFor(steamId);

    audio.volume = volume;
    audio.muted = muted;
  }

  return {
    peers,
    settingsFor,
    volumeOf: (steamId: string) => settingsFor(steamId).volume,
    isMuted: (steamId: string) => settingsFor(steamId).muted,
    setVolume,
    setMuted,
    toggleMuted,
    reset,
    apply,
  };
}
