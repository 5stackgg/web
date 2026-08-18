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
  // `error` is an i18n key; `errorDetail` is the raw technical line.
  error: Ref<string | null>;
  errorDetail: Ref<string | null>;
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
    entry.errorDetail.value = null;
  } catch (caught) {
    entry.error.value = "camera.errors.load_failed";
    entry.errorDetail.value =
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
      errorDetail: ref<string | null>(null),
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

type CameraLineupShape = {
  is_on_lineup?: boolean | null;
  coach?: { steam_id?: string | null } | null;
} | null;

type CameraMatch = {
  is_organizer?: boolean | null;
  is_in_lineup?: boolean | null;
  is_coach?: boolean | null;
  lineup_1?: CameraLineupShape;
  lineup_2?: CameraLineupShape;
  options?: {
    camera_required?: boolean | null;
    camera_allow_teammates?: boolean | null;
  } | null;
};

// "all" is both lineups; "own-lineup" is a competitor seeing only their side.
export type CameraWatchScope = "all" | "own-lineup" | "none";

// On a side, which is what the API's watchScope means by `my_lineup_id`: the
// lineup's roster *or* its coach. Coaches publish a camera of their own, so
// they are a competitor for the purposes of "nobody playing may watch the other
// team" -- including when they also happen to organise the match.
function isPlaying(match: CameraMatch) {
  if (match.lineup_1?.is_on_lineup || match.lineup_2?.is_on_lineup) {
    return true;
  }

  const mySteamId = useAuthStore().me?.steam_id;

  if (
    mySteamId &&
    (match.lineup_1?.coach?.steam_id === mySteamId ||
      match.lineup_2?.coach?.steam_id === mySteamId)
  ) {
    return true;
  }

  return !!match.is_in_lineup || !!match.is_coach;
}

// The single copy of this rule on the client, mirroring CameraService.watchScope
// on the API.
//
// Nothing here is load-bearing: the server filters the lineups it returns and
// re-checks the roster on every WHEP negotiation, talk and status call, so a
// client that lies about its own scope still gets nothing. This exists so the
// UI never offers a grid the server will refuse, and never implies a competitor
// can watch the other team. It had drifted into two copies once already --
// keep it as one.
export function matchCameraScope(
  match: CameraMatch | null | undefined,
): CameraWatchScope {
  if (!match?.options?.camera_required) {
    return "none";
  }

  const isAdmin = useAuthStore().isRoleAbove(e_player_roles_enum.administrator);

  if (isPlaying(match)) {
    // Same exception the API makes: an administrator keeps full access so the
    // feature can be exercised end to end from one account. An organizer who is
    // playing does not -- they are a competitor, and a live view of the other
    // team is the advantage this whole feature exists to prevent.
    if (isAdmin) {
      return "all";
    }

    return match.options?.camera_allow_teammates ? "own-lineup" : "none";
  }

  // Not playing: administrators, or an organizer of this specific match -- not
  // the global tournament_organizer role, which would reach every tournament's
  // cameras rather than just this one.
  return isAdmin || match.is_organizer ? "all" : "none";
}

export function canWatchMatchCameras(match: CameraMatch | null | undefined) {
  return matchCameraScope(match) !== "none";
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
  const errorDetail = ref<string | null>(null);
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
      [entry.lineups, entry.error, entry.errorDetail, entry.loaded],
      ([nextLineups, nextError, nextErrorDetail, nextLoaded]) => {
        lineups.value = nextLineups;
        error.value = nextError;
        errorDetail.value = nextErrorDetail;
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

  return {
    lineups,
    players,
    error,
    errorDetail,
    loaded,
    summary,
    statusFor,
    refresh,
  };
}
