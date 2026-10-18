// Pure rules behind the Control Room: whether a match can go on air, what
// blocks a take, and the order the preview monitors sit in.

export type ControlRoomMap = {
  id: string;
  lineup_1_score: number | null;
  lineup_2_score: number | null;
  map: {
    name?: string | null;
    label?: string | null;
    poster?: string | null;
  } | null;
};

export type ControlRoomMatch = {
  id: string;
  status: string;
  current_match_map_id?: string | null;
  server_id: string | null;
  is_server_online: boolean | null;
  match_maps?: ControlRoomMap[];
};

// Why a match can't be put on air yet, as an i18n key suffix under
// pages.control_room.reasons.
export type ReadinessReason =
  | "veto"
  | "waiting_for_server"
  | "check_in"
  | "not_live"
  | "no_server"
  | "server_offline";

export type TakeBlock =
  ReadinessReason | "no_gpu_nodes" | "no_free_gpu" | "at_capacity";

export function matchReadiness(
  match: ControlRoomMatch,
): ReadinessReason | null {
  if (match.status !== "Live") {
    if (match.status === "Veto") return "veto";
    if (match.status === "WaitingForServer") return "waiting_for_server";
    if (match.status === "WaitingForCheckIn") return "check_in";
    return "not_live";
  }
  if (!match.server_id) return "no_server";
  if (match.is_server_online !== true) return "server_offline";
  return null;
}

export type TakeMode = "start" | "switch";

// With a broadcast running and no room for another, a take repoints the
// running pod; otherwise it boots a new one.
export function takeMode(hasStream: boolean, atCapacity: boolean): TakeMode {
  return hasStream && atCapacity ? "switch" : "start";
}

export function takeBlock(opts: {
  match: ControlRoomMatch;
  mode: TakeMode;
  gpuTotal: number;
  gpuPoolReady: boolean;
  hasFreeGpu: boolean;
  atCapacity: boolean;
}): TakeBlock | null {
  const reason = matchReadiness(opts.match);
  if (reason) return reason;
  // A switch reuses the pod that's already running: no GPU needed.
  if (opts.mode === "switch") return null;
  if (opts.gpuPoolReady && opts.gpuTotal === 0) return "no_gpu_nodes";
  if (!opts.hasFreeGpu) return "no_free_gpu";
  if (opts.atCapacity) return "at_capacity";
  return null;
}

// On air first, then live matches, then the ones still on their way;
// the subscription's order breaks ties.
export function sortPreviews<T extends ControlRoomMatch>(
  matches: T[],
  onAirIds: Set<string>,
): T[] {
  const rank = (m: T) => (onAirIds.has(m.id) ? 0 : m.status === "Live" ? 1 : 2);
  return matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => rank(a.match) - rank(b.match) || a.index - b.index)
    .map(({ match }) => match);
}

// The preview picked when the page opens: the first ready match that isn't
// already on air.
export function defaultPreview(
  matches: ControlRoomMatch[],
  onAirIds: Set<string>,
): string | null {
  const first = matches.find(
    (m) => !onAirIds.has(m.id) && matchReadiness(m) === null,
  );
  return first?.id ?? null;
}

// The map being played: current_match_map_id, else the last map with a
// scored round so a paused or just-finished map keeps its scoreline.
export function currentMapFor(match: ControlRoomMatch): ControlRoomMap | null {
  const maps = match.match_maps ?? [];
  if (!maps.length) return null;
  if (match.current_match_map_id) {
    const found = maps.find((mm) => mm.id === match.current_match_map_id);
    if (found) return found;
  }
  for (let i = maps.length - 1; i >= 0; i--) {
    const mm = maps[i];
    if ((mm.lineup_1_score ?? 0) + (mm.lineup_2_score ?? 0) > 0) return mm;
  }
  return null;
}

// When the stream last went live, from its status history. Null while it
// hasn't.
export function wentLiveAt(
  stream: {
    is_live?: boolean | null;
    status_history?: Array<{ status?: string; at?: string }> | null;
    last_status_at?: string | null;
  } | null,
): number | null {
  if (!stream?.is_live) return null;
  const history = stream.status_history ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.status === "live" && history[i].at) {
      const at = new Date(history[i].at as string).getTime();
      if (!Number.isNaN(at)) return at;
    }
  }
  const fallback = stream.last_status_at
    ? new Date(stream.last_status_at).getTime()
    : NaN;
  return Number.isNaN(fallback) ? null : fallback;
}

export function onAirClock(fromMs: number, nowMs: number): string {
  const total = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
