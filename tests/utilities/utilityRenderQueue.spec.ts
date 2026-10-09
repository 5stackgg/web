import { describe, expect, it } from "vitest";
import {
  liveUtilityRenderIds,
  utilityLineupsRendering,
  utilityRenderFilmedAt,
  utilityRenderIsOutdated,
  utilityRenderIsStale,
  utilityRenderQueueView,
  utilityRenderStage,
} from "~/utilities/utilityRenderQueue";

const CDN = "https://cf.5stack.gg/clips/utility";

function render(
  id: string,
  lineup: string,
  status: string,
  previewUrl: string | null = null,
) {
  return {
    id,
    utility_lineup_id: lineup,
    status: status as any,
    lineup: { preview_url: previewUrl },
  };
}

describe("liveUtilityRenderIds", () => {
  it("marks the done render the lineup's preview is filed under", () => {
    const live = liveUtilityRenderIds([
      render("r-2", "l-1", "done", `${CDN}/l-1/r-2.mp4`),
      render("r-1", "l-1", "done", `${CDN}/l-1/r-2.mp4`),
      render("r-0", "l-1", "error", `${CDN}/l-1/r-2.mp4`),
    ]);

    expect([...live]).toEqual(["r-2"]);
  });

  it("gives an older lineup-keyed preview to its only done render", () => {
    expect([
      ...liveUtilityRenderIds([
        render("r-1", "l-1", "done", `${CDN}/l-1.mp4?v=3`),
        render("r-0", "l-1", "error", `${CDN}/l-1.mp4?v=3`),
      ]),
    ]).toEqual(["r-1"]);
  });

  it("gives a lineup-keyed preview to no one when two done renders could own it", () => {
    expect(
      liveUtilityRenderIds([
        render("r-1", "l-1", "done", `${CDN}/l-1.mp4`),
        render("r-2", "l-1", "done", `${CDN}/l-1.mp4`),
      ]).size,
    ).toBe(0);
  });

  it("marks nothing for a lineup without a preview", () => {
    expect(liveUtilityRenderIds([render("r-1", "l-1", "done")]).size).toBe(0);
  });
});

describe("utilityLineupsRendering", () => {
  it("names the lineups with a render queued, filming or uploading", () => {
    const rendering = utilityLineupsRendering([
      render("r-1", "l-1", "queued"),
      render("r-2", "l-2", "rendering"),
      render("r-3", "l-3", "uploading"),
      render("r-4", "l-4", "done"),
      render("r-5", "l-5", "error"),
    ]);

    expect([...rendering].sort()).toEqual(["l-1", "l-2", "l-3"]);
  });
});

const T0 = Date.parse("2026-10-09T10:00:00Z");
const at = (seconds: number) => new Date(T0 + seconds * 1000).toISOString();

const STAGES = {
  boot: new Set([
    "booking_server",
    "server_starting",
    "dispatching_pod",
    "launching_cs2",
    "connecting_to_game",
  ]),
  wait: new Set(["waiting_turn", "waiting_for_map", "changing_map"]),
};

let made = 0;

// A queued row whose history is these boot ticks, each `[stage, seconds]`,
// last heard from at its last tick.
function queued(
  id: string,
  mapName: string,
  ticks: Array<[string, number]> = [],
  extra: Record<string, unknown> = {},
) {
  made++;
  return {
    id,
    map_name: mapName,
    status: "queued" as const,
    k8s_job_name: null as string | null,
    sort_index: 0,
    status_history: [
      { status: "queued", at: at(0) },
      ...ticks.map(([stage, seconds]) => ({
        status: "booting",
        at: at(seconds),
        boot_stage: stage,
      })),
    ],
    last_status_at: at(ticks.length ? ticks[ticks.length - 1][1] : 0),
    created_at: at(made / 1000),
    ...extra,
  };
}

const view = (
  renders: Array<ReturnType<typeof queued>>,
  seconds: number,
  filmedAt = 0,
) =>
  utilityRenderQueueView(renders, {
    now: T0 + seconds * 1000,
    filmedAt,
    stages: STAGES,
  });

const stageOf = (queue: ReturnType<typeof view>, id: string) =>
  queue.maps.flatMap((map) => map.rows).find((row) => row.render.id === id)
    ?.stage?.key ?? null;

describe("utilityRenderStage", () => {
  it("is the row's own last boot tick, with what follows the colon", () => {
    expect(
      utilityRenderStage(
        queued("r-1", "de_nuke", [
          ["waiting_for_map", 5],
          ["changing_map:de_nuke", 60],
        ]),
      ),
    ).toMatchObject({ key: "changing_map", sub: "de_nuke" });
  });

  it("is nothing for a row that has gone on to something else since", () => {
    const row = queued("r-1", "de_nuke", [["waiting_turn", 5]]);
    row.status_history.push({ status: "rendering", at: at(9) });

    expect(utilityRenderStage(row)).toBeNull();
    expect(utilityRenderStage(queued("r-2", "de_nuke"))).toBeNull();
  });
});

describe("utilityRenderIsStale", () => {
  const HOUR = 3600;

  it("flags a render that claims to be working and went quiet", () => {
    const filming = queued("r-1", "de_mirage", [], { status: "rendering" });

    expect(utilityRenderIsStale(filming, T0 + 60_000)).toBe(false);
    expect(utilityRenderIsStale(filming, T0 + 120_000)).toBe(true);
  });

  it("never flags a row waiting its turn or its map, however long", () => {
    const turn = queued("r-1", "de_mirage", [["waiting_turn", 0]]);
    const map = queued("r-2", "de_nuke", [["waiting_for_map", 0]]);

    expect(utilityRenderIsStale(turn, T0 + HOUR * 1000)).toBe(false);
    expect(utilityRenderIsStale(map, T0 + HOUR * 1000)).toBe(false);
  });

  it("gives a map change five minutes before calling it stuck", () => {
    const moving = queued("r-1", "de_nuke", [["changing_map:de_nuke", 0]]);

    expect(utilityRenderIsStale(moving, T0 + 120_000)).toBe(false);
    expect(utilityRenderIsStale(moving, T0 + 299_000)).toBe(false);
    expect(utilityRenderIsStale(moving, T0 + 301_000)).toBe(true);
  });

  it("leaves a queued row in the pod's boot alone", () => {
    const booting = queued("r-1", "de_mirage", [["dispatching_pod", 0]]);

    expect(utilityRenderIsStale(booting, T0 + 600_000)).toBe(false);
  });
});

describe("utilityRenderQueueView", () => {
  it("lists the map the pod is on first, then the rest in queue order", () => {
    const queue = view(
      [
        queued("a-1", "de_ancient", [["waiting_for_map", 1]]),
        queued("n-1", "de_nuke", [["waiting_for_map", 1]]),
        queued("m-1", "de_mirage", [], { status: "rendering" }),
        queued("m-2", "de_mirage", [["waiting_turn", 30]]),
      ],
      40,
    );

    expect(queue.maps.map((map) => map.mapName)).toEqual([
      "de_mirage",
      "de_ancient",
      "de_nuke",
    ]);
    expect(queue.maps.map((map) => map.here)).toEqual([true, false, false]);
    expect(queue.maps[0].rows.map((row) => row.render.id)).toEqual([
      "m-1",
      "m-2",
    ]);
    expect(queue.active?.id).toBe("m-1");
    expect(queue.count).toBe(4);
  });

  it("puts the map being changed to first while nothing is filming", () => {
    const queue = view(
      [
        queued("a-1", "de_ancient", [["waiting_for_map", 1]]),
        queued("n-1", "de_nuke", [
          ["waiting_for_map", 1],
          ["changing_map:de_nuke", 50],
        ]),
      ],
      60,
    );

    expect(queue.maps.map((map) => map.mapName)).toEqual([
      "de_nuke",
      "de_ancient",
    ]);
    expect(stageOf(queue, "n-1")).toBe("changing_map");
    expect(stageOf(queue, "a-1")).toBe("waiting_for_map");
    expect(queue.booting).toBe(false);
    expect(queue.unclaimed).toBe(false);
  });

  it("gives each row its own stage while the pod boots", () => {
    const queue = view(
      [
        queued("m-1", "de_mirage", [["launching_cs2", 50]], {
          k8s_job_name: "gs-nades-queue",
        }),
        queued("m-2", "de_mirage", [["dispatching_pod", 20]]),
        queued("n-1", "de_nuke", [["waiting_for_map", 10]]),
      ],
      60,
    );

    expect(stageOf(queue, "m-1")).toBe("launching_cs2");
    expect(stageOf(queue, "m-2")).toBe("dispatching_pod");
    expect(stageOf(queue, "n-1")).toBe("waiting_for_map");
    expect(queue.booting).toBe(true);
  });

  // The pod's boot ticks stay on every row it was started with for as long
  // as that row is queued.
  it("reads a row still carrying a boot stage as waiting once the pod films", () => {
    const queue = view(
      [
        queued("m-1", "de_mirage", [["connecting_to_game", 50]], {
          status: "rendering",
          k8s_job_name: "gs-nades-queue",
        }),
        queued("m-2", "de_mirage", [["connecting_to_game", 50]], {
          k8s_job_name: "gs-nades-queue",
        }),
        queued("m-3", "de_mirage", [["dispatching_pod", 20]]),
      ],
      90,
    );

    expect(stageOf(queue, "m-2")).toBe("waiting_turn");
    expect(stageOf(queue, "m-3")).toBe("waiting_turn");
    expect(queue.booting).toBe(false);
  });

  it("keeps reading it that way in the gap between two lineups", () => {
    const rows = [
      queued("m-2", "de_mirage", [["connecting_to_game", 50]], {
        k8s_job_name: "gs-nades-queue",
      }),
    ];

    const between = view(rows, 100, T0 + 95_000);
    expect(stageOf(between, "m-2")).toBe("waiting_turn");
    expect(between.booting).toBe(false);

    const neverFilmed = view(rows, 100);
    expect(stageOf(neverFilmed, "m-2")).toBe("connecting_to_game");
    expect(neverFilmed.booting).toBe(true);
  });

  it("drops a boot stage nothing has confirmed for five minutes", () => {
    const rows = [queued("m-1", "de_mirage", [["server_starting", 0]])];

    expect(stageOf(view(rows, 200), "m-1")).toBe("server_starting");
    expect(stageOf(view(rows, 400), "m-1")).toBeNull();
    expect(view(rows, 400).booting).toBe(false);
  });

  it("keeps a wait on the row however long ago it was stamped", () => {
    const rows = [
      queued("m-1", "de_mirage", [], {
        status: "rendering",
        last_status_at: at(7195),
      }),
      queued("n-1", "de_nuke", [["waiting_for_map", 0]]),
    ];

    expect(stageOf(view(rows, 7200), "n-1")).toBe("waiting_for_map");
  });

  it("shows nothing for a stage it has no name for", () => {
    const queue = view(
      [queued("m-1", "de_mirage", [["defragmenting_disk", 5]])],
      10,
    );

    expect(stageOf(queue, "m-1")).toBeNull();
  });

  it("says nothing has picked the queue up only once that has lasted", () => {
    const rows = [queued("m-1", "de_mirage"), queued("m-2", "de_mirage")];

    expect(view(rows, 30).unclaimed).toBe(false);
    expect(view(rows, 120).unclaimed).toBe(true);
  });

  it("does not say so while a server is booking or a pod holds a row", () => {
    expect(
      view([queued("m-1", "de_mirage", [["booking_server", 100]])], 200)
        .unclaimed,
    ).toBe(false);
    expect(
      view(
        [
          queued("m-1", "de_mirage", [["waiting_turn", 0]], {
            k8s_job_name: "gs-nades-queue",
          }),
        ],
        600,
      ).unclaimed,
    ).toBe(false);
  });
});

describe("utilityRenderFilmedAt", () => {
  it("is the last word from a row being filmed or one a pod finished", () => {
    expect(
      utilityRenderFilmedAt([
        {
          ...queued("r-1", "de_mirage"),
          status: "done",
          last_status_at: at(90),
        },
        {
          ...queued("r-2", "de_mirage"),
          status: "done",
          k8s_job_name: "gs-nades-queue",
          last_status_at: at(60),
        },
        {
          ...queued("r-3", "de_mirage"),
          status: "error",
          k8s_job_name: "gs-nades-queue",
          last_status_at: at(80),
        },
        { ...queued("r-4", "de_mirage"), last_status_at: at(99) },
      ]),
    ).toBe(T0 + 60_000);
  });
});

describe("utilityRenderIsOutdated", () => {
  it("is anything older than what is expected", () => {
    expect(utilityRenderIsOutdated(1, 2)).toBe(true);
    expect(utilityRenderIsOutdated(2, 2)).toBe(false);
    expect(utilityRenderIsOutdated(3, 2)).toBe(false);
  });

  it("is always a render that never said what filmed it", () => {
    expect(utilityRenderIsOutdated(0, 2)).toBe(true);
    expect(utilityRenderIsOutdated(null, 2)).toBe(true);
    expect(utilityRenderIsOutdated(null, null)).toBe(true);
  });

  it("cannot be told while what is expected is not known", () => {
    expect(utilityRenderIsOutdated(1, null)).toBe(false);
  });
});
