import { computed, ref, unref, watch, onScopeDispose, type Ref } from "vue";
import {
  fetchCameraPlayers,
  type CameraLineup,
  type CameraPlayerStatus,
} from "~/composables/useCameraApi";
import socket from "~/web-sockets/Socket";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

// A backstop, not the signal: the socket pushes the moment a camera flips, so
// this only has to catch a missed push or a reconnect.
const POLL_MS = 10000;

type Shared = {
  lineups: Ref<Array<CameraLineup>>;
  error: Ref<string | null>;
  loaded: Ref<boolean>;
  subscribers: number;
  timer: ReturnType<typeof setInterval> | null;
};

// One poll per match no matter how many rows, badges and grids ask for it.
const shared = new Map<string, Shared>();

async function load(matchId: string, entry: Shared) {
  try {
    entry.lineups.value = (await fetchCameraPlayers(matchId)).lineups;
    entry.error.value = null;
  } catch (caught) {
    entry.error.value =
      caught instanceof Error ? caught.message : String(caught);
  } finally {
    entry.loaded.value = true;
  }
}

// The API pushes a bare {matchId} when a camera changes state — no player data
// rides the socket, because it reaches every connected client. Everyone re-reads
// through the authorized endpoint instead, so a push can never leak who is on
// camera to someone who could not already ask.
let socketBound = false;

function bindSocket() {
  if (socketBound) {
    return;
  }

  socketBound = true;

  socket.on("camera-status", (data: { matchId?: string } | undefined) => {
    const matchId = data?.matchId;

    if (!matchId) {
      return;
    }

    const entry = shared.get(matchId);

    if (entry) {
      void load(matchId, entry);
    }
  });
}

// Nobody is reading a camera badge from a tab they cannot see, and the players
// this runs for are usually in the game. Polling resumes -- with an immediate
// read, so nothing is stale -- when the tab comes back.
let visibilityBound = false;

function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") {
    return;
  }

  visibilityBound = true;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      return;
    }

    for (const [matchId, entry] of shared) {
      void load(matchId, entry);
    }
  });
}

function acquire(matchId: string) {
  let entry = shared.get(matchId);

  if (!entry) {
    entry = {
      lineups: ref<Array<CameraLineup>>([]),
      error: ref<string | null>(null),
      loaded: ref(false),
      subscribers: 0,
      timer: null,
    };
    shared.set(matchId, entry);
  }

  entry.subscribers += 1;

  if (!entry.timer) {
    bindSocket();
    bindVisibility();
    void load(matchId, entry);
    // Kept as a slow backstop rather than the primary signal: the push covers
    // the moment a camera flips, this catches a missed frame or a reconnect.
    entry.timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }

      void load(matchId, entry as Shared);
    }, POLL_MS);
  }

  return entry;
}

function release(matchId: string) {
  const entry = shared.get(matchId);

  if (!entry) {
    return;
  }

  entry.subscribers -= 1;

  if (entry.subscribers > 0) {
    return;
  }

  if (entry.timer) {
    clearInterval(entry.timer);
    entry.timer = null;
  }

  shared.delete(matchId);
}

// Mirrors CameraService.assertCanWatch: administrators, or an organizer of this
// specific match -- not the global tournament_organizer role, which would reach
// every tournament's cameras rather than just this one.
export function canWatchMatchCameras(
  match:
    | {
        is_organizer?: boolean | null;
        options?: { camera_required?: boolean | null } | null;
      }
    | null
    | undefined,
) {
  if (!match?.options?.camera_required) {
    return false;
  }

  if (match.is_organizer) {
    return true;
  }

  return useAuthStore().isRoleAbove(e_player_roles_enum.administrator);
}

export function useMatchCameraStatus(
  matchId: Ref<string> | (() => string) | string,
  enabled: Ref<boolean> | (() => boolean) | boolean = true,
) {
  const id = computed(() =>
    typeof matchId === "function" ? matchId() : String(unref(matchId)),
  );
  const on = computed(() =>
    typeof enabled === "function" ? enabled() : Boolean(unref(enabled)),
  );

  const lineups = ref<Array<CameraLineup>>([]);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  let bound: string | null = null;
  let stopMirror: (() => void) | null = null;

  function unbind() {
    if (!bound) {
      return;
    }

    stopMirror?.();
    stopMirror = null;
    release(bound);
    bound = null;
  }

  function bind() {
    unbind();

    if (!on.value || !id.value) {
      lineups.value = [];
      loaded.value = false;
      return;
    }

    const entry = acquire(id.value);
    bound = id.value;

    stopMirror = watch(
      [entry.lineups, entry.error, entry.loaded],
      ([nextLineups, nextError, nextLoaded]) => {
        lineups.value = nextLineups;
        error.value = nextError;
        loaded.value = nextLoaded;
      },
      { immediate: true },
    );
  }

  watch([id, on], bind, { immediate: true });
  onScopeDispose(unbind);

  const players = computed(() =>
    lineups.value.flatMap((lineup) => lineup.players),
  );

  const bySteamId = computed(() => {
    const map: Record<string, CameraPlayerStatus> = {};

    for (const player of players.value) {
      map[player.steamId] = player;
    }

    return map;
  });

  const summary = computed(() => {
    const all = players.value;

    return {
      total: all.length,
      live: all.filter((player) => player.ready && player.health === "live")
        .length,
      stalled: all.filter((player) => player.health === "stalled").length,
      down: all.filter((player) => !player.ready || player.health === "down")
        .length,
    };
  });

  function statusFor(steamId: string): CameraPlayerStatus | null {
    return bySteamId.value[steamId] ?? null;
  }

  function refresh() {
    const entry = bound ? shared.get(bound) : null;

    if (entry && bound) {
      return load(bound, entry);
    }

    return Promise.resolve();
  }

  return { lineups, players, error, loaded, summary, statusFor, refresh };
}
