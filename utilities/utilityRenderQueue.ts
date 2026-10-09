import type { UtilityLineupRender } from "~/types/utility";

type QueueRender = Pick<
  UtilityLineupRender,
  "id" | "utility_lineup_id" | "status"
> & {
  lineup?: { preview_url?: string | null } | null;
};

const IN_FLIGHT = new Set(["queued", "rendering", "uploading"]);

function previewPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

/**
 * The renders whose clip is a lineup's preview right now -- the rows whose
 * delete takes the preview down with them. The api files a preview under the
 * render that made it; one filed under the lineup alone predates that and
 * belongs to the lineup's only done render, or to none when there are two.
 */
export function liveUtilityRenderIds(renders: QueueRender[]): Set<string> {
  const live = new Set<string>();
  const doneByLineup = new Map<string, QueueRender[]>();

  for (const render of renders) {
    if (render.status !== "done") {
      continue;
    }
    const list = doneByLineup.get(render.utility_lineup_id) ?? [];
    list.push(render);
    doneByLineup.set(render.utility_lineup_id, list);
  }

  for (const [lineupId, done] of doneByLineup) {
    for (const render of done) {
      const url = render.lineup?.preview_url;
      if (!url) {
        continue;
      }
      const path = previewPath(url);
      if (path.endsWith(`/${lineupId}/${render.id}.mp4`)) {
        live.add(render.id);
      } else if (
        path.endsWith(`/clips/utility/${lineupId}.mp4`) &&
        done.length === 1
      ) {
        live.add(render.id);
      }
    }
  }

  return live;
}

// The api turns down a second render for a lineup while one is under way.
export function utilityLineupsRendering(renders: QueueRender[]): Set<string> {
  return new Set(
    renders
      .filter((render) => IN_FLIGHT.has(render.status))
      .map((render) => render.utility_lineup_id),
  );
}

// A render that claims to be working posts on every segment poll, so this
// long without a word is the signal -- not a status nothing overwrote.
export const RENDER_STALE_AFTER_MS = 90_000;
// The api gives a level four minutes to come up before it stops the pod.
export const RENDER_MAP_CHANGE_STALE_MS = 5 * 60_000;
// A boot tick older than this is a pod that stopped talking.
export const RENDER_BOOT_RECENCY_MS = 5 * 60_000;

const WAITING_TURN = "waiting_turn";
const WAITING_FOR_MAP = "waiting_for_map";
const CHANGING_MAP = "changing_map";

type HistoryRender = Pick<
  UtilityLineupRender,
  "status" | "status_history" | "last_status_at" | "created_at"
>;

type QueuedRender = HistoryRender &
  Pick<UtilityLineupRender, "id" | "map_name" | "k8s_job_name" | "sort_index">;

export type UtilityRenderStage = {
  key: string;
  // "server_starting:WaitingForPing", "changing_map:de_nuke".
  sub: string | null;
  progress: number | null;
  at: number;
};

// The row's own latest boot tick. The api stamps these per row, and a row
// that has gone on to anything else since is no longer in one.
export function utilityRenderStage(
  render: HistoryRender,
): UtilityRenderStage | null {
  const history = render.status_history ?? [];
  const last = history[history.length - 1];
  if (last?.status !== "booting" || !last.boot_stage) {
    return null;
  }
  const at = Date.parse(last.at);
  if (!Number.isFinite(at)) {
    return null;
  }
  const cut = last.boot_stage.indexOf(":");
  const sub = cut < 0 ? "" : last.boot_stage.slice(cut + 1);
  return {
    key: cut < 0 ? last.boot_stage : last.boot_stage.slice(0, cut),
    sub: sub.length > 0 ? sub : null,
    progress:
      typeof last.boot_progress === "number"
        ? Math.max(0, Math.min(1, last.boot_progress))
        : null,
    at,
  };
}

function heardAt(render: HistoryRender): number {
  const at = Date.parse(render.last_status_at ?? render.created_at ?? "");
  return Number.isFinite(at) ? at : 0;
}

/**
 * Nothing films a queued row, so its silence says nothing: one waiting its
 * turn or its map is not stale however long that takes. The exception is the
 * map being changed to, which either comes up within minutes or never does.
 */
export function utilityRenderIsStale(
  render: HistoryRender,
  now: number,
): boolean {
  const heard = heardAt(render);
  if (!heard) {
    return false;
  }
  if (render.status !== "queued") {
    return now - heard > RENDER_STALE_AFTER_MS;
  }
  return (
    utilityRenderStage(render)?.key === CHANGING_MAP &&
    now - heard > RENDER_MAP_CHANGE_STALE_MS
  );
}

// The latest the pod is known to have been filming: a row it is on now, or
// one it finished. Only a pod finishes a render with its own name on it.
export function utilityRenderFilmedAt(
  renders: Array<HistoryRender & Pick<UtilityLineupRender, "k8s_job_name">>,
): number {
  return renders.reduce((latest, render) => {
    const filmed =
      render.status === "rendering" ||
      render.status === "uploading" ||
      (render.status === "done" && !!render.k8s_job_name);
    return filmed ? Math.max(latest, heardAt(render)) : latest;
  }, 0);
}

export type UtilityRenderQueueRow<T> = {
  render: T;
  // What the row is doing, when that is more than its status says.
  stage: UtilityRenderStage | null;
  stale: boolean;
};

export type UtilityRenderQueueMap<T> = {
  mapName: string;
  // The pod is on this map, or on its way to it.
  here: boolean;
  rows: UtilityRenderQueueRow<T>[];
};

export type UtilityRenderQueueView<T> = {
  maps: UtilityRenderQueueMap<T>[];
  count: number;
  active: T | null;
  booting: boolean;
  // Nothing is booking a server for these and no pod has been handed one.
  unclaimed: boolean;
  sample: T | null;
};

function byQueueOrder(a: QueuedRender, b: QueuedRender): number {
  const first = a.sort_index ?? Number.MAX_SAFE_INTEGER;
  const second = b.sort_index ?? Number.MAX_SAFE_INTEGER;
  if (first !== second) {
    return first - second;
  }
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/**
 * The queue as one pod films it: map by map, the map it is on first, and
 * each row saying what it is itself waiting on.
 *
 * `stages.boot` are the stages of the pod's boot and `stages.wait` a row's
 * own waits. A boot stage is a fact about the pod that every row it was
 * stamped on goes on carrying -- so once the pod has filmed anything since
 * (`filmedAt`, or a row filming now) the boot is over and such a row is
 * simply waiting.
 */
export function utilityRenderQueueView<T extends QueuedRender>(
  renders: T[],
  options: {
    now: number;
    filmedAt?: number;
    stages: { boot: ReadonlySet<string>; wait: ReadonlySet<string> };
  },
): UtilityRenderQueueView<T> {
  const { now, stages } = options;
  const filmedAt = options.filmedAt ?? 0;
  const ordered = [...renders].sort(byQueueOrder);
  const active = ordered.find((render) => render.status !== "queued") ?? null;
  const heard = ordered.reduce(
    (latest, render) => Math.max(latest, heardAt(render)),
    0,
  );
  const fresh = now - heard <= RENDER_BOOT_RECENCY_MS;

  const own = new Map<string, UtilityRenderStage | null>(
    ordered.map((render) => [
      render.id,
      render.status === "queued" ? utilityRenderStage(render) : null,
    ]),
  );
  const booted = (render: T) => {
    const stage = own.get(render.id);
    return (
      !!stage &&
      stages.boot.has(stage.key) &&
      (active !== null || stage.at <= filmedAt)
    );
  };
  const handed = ordered.find(
    (render) => render.status === "queued" && !!render.k8s_job_name,
  );
  const here =
    active?.map_name ??
    ordered.find((render) => own.get(render.id)?.key === CHANGING_MAP)
      ?.map_name ??
    handed?.map_name ??
    ordered.find((render) => own.get(render.id)?.key === WAITING_TURN)
      ?.map_name ??
    ordered.find((render) => {
      const stage = own.get(render.id);
      return !!stage && stages.boot.has(stage.key) && fresh;
    })?.map_name ??
    null;

  const rows = ordered.map((render): UtilityRenderQueueRow<T> => {
    let stage = own.get(render.id) ?? null;
    if (stage && stages.boot.has(stage.key)) {
      if (booted(render)) {
        stage = {
          key: render.map_name === here ? WAITING_TURN : WAITING_FOR_MAP,
          sub: null,
          progress: null,
          at: stage.at,
        };
      } else if (!fresh) {
        stage = null;
      }
    } else if (stage && !stages.wait.has(stage.key)) {
      stage = null;
    }
    return { render, stage, stale: utilityRenderIsStale(render, now) };
  });

  const byMap = new Map<string, UtilityRenderQueueRow<T>[]>();
  for (const row of rows) {
    const list = byMap.get(row.render.map_name) ?? [];
    if (row.render === active) {
      list.unshift(row);
    } else {
      list.push(row);
    }
    byMap.set(row.render.map_name, list);
  }
  const maps = [...byMap.entries()]
    .map(([mapName, list]) => ({
      mapName,
      here: mapName === here,
      rows: list,
    }))
    .sort((a, b) => Number(b.here) - Number(a.here));

  const booting =
    !active &&
    rows.some((row) => !!row.stage && stages.boot.has(row.stage.key));
  const changing = rows.some(
    (row) => row.stage?.key === CHANGING_MAP && !row.stale,
  );

  return {
    maps,
    count: rows.length,
    active,
    booting,
    unclaimed:
      rows.length > 0 &&
      !active &&
      !booting &&
      !handed &&
      !changing &&
      now - Math.max(heard, filmedAt) > RENDER_STALE_AFTER_MS,
    sample: active ?? handed ?? maps[0]?.rows[0]?.render ?? null,
  };
}

// Whether a preview, or the render that made it, was filmed by an older
// pipeline than `expected`. One that never said what filmed it predates the
// question, whatever is expected.
export function utilityRenderIsOutdated(
  version: number | null | undefined,
  expected: number | null | undefined,
): boolean {
  if (!version) {
    return true;
  }
  return typeof expected === "number" && version < expected;
}
