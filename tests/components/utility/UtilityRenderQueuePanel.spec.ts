import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useNuxtApp } from "#app";
import UtilityRenderQueuePanel from "~/components/utility/UtilityRenderQueuePanel.vue";
import { Select } from "~/components/ui/select";
import { useToast } from "~/components/ui/toast";

const CDN = "https://cf.5stack.gg/clips/utility";

function row(id: string, lineup: string, status: string, preview?: string) {
  return {
    id,
    utility_lineup_id: lineup,
    map_name: "de_mirage",
    status,
    progress: status === "done" ? 1 : 0,
    error_message: status === "error" ? "pod went quiet" : null,
    skip_reason: null,
    duration_ms: 20000,
    k8s_job_name: null,
    game_server_node_id: null,
    paused: false,
    sort_index: 0,
    status_history: [],
    last_status_at: "2026-10-08T10:00:00Z",
    created_at: "2026-10-08T09:59:00Z",
    lineup: {
      id: lineup,
      name: `Lineup ${lineup}`,
      map_name: "de_mirage",
      preview_url: preview ?? null,
      preview_thumbnail_url: null,
    },
  };
}

const DEFAULT_ROWS = {
  inFlight: [row("r-9", "l-2", "rendering")],
  finished: [
    row("r-1", "l-1", "done", `${CDN}/l-1/r-1.mp4`),
    row("r-0", "l-1", "error", `${CDN}/l-1/r-1.mp4`),
    row("r-2", "l-2", "done", `${CDN}/l-2/r-2.mp4`),
  ],
};

const rows: { inFlight: any[]; finished: any[] } = { ...DEFAULT_ROWS };

// What each subscription last handed the panel, to hand it something new.
const feed: { inFlight: () => void; finished: () => void } = {
  inFlight: () => {},
  finished: () => {},
};

function gap(id: string, state: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: `Gap ${id}`,
    map_name: "de_mirage",
    utility_type: "Smoke",
    state,
    preview_version: null,
    reason: null,
    ...extra,
  };
}

const GAPS = [
  gap("g-1", "missing"),
  gap("g-2", "outdated", { preview_version: 1, utility_type: "Flash" }),
  gap("g-3", "unrenderable", {
    map_name: "de_nuke",
    reason: "it has no physics seed",
  }),
];

function coverageOf(extra: Record<string, unknown> = {}) {
  return {
    version: 2,
    pipeline_version: 2,
    total: 125,
    current: 120,
    missing: 1,
    outdated: 1,
    queued: 2,
    unrenderable: 1,
    lineups: GAPS,
    ...extra,
  };
}

// What the api answers for a map, or for all of them under "".
const coverages: Record<string, any> = {};
const asked: Array<string | null> = [];

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: ({ variables }: any) => ({
      subscribe: ({ next }: any) => {
        const finished = variables?.statuses?.includes("done");
        const push = () =>
          next({
            data: {
              utility_lineup_renders: finished ? rows.finished : rows.inFlight,
            },
          });
        feed[finished ? "finished" : "inFlight"] = push;
        setTimeout(push);
        return { unsubscribe() {} };
      },
    }),
    query: async ({ variables }: any) => {
      asked.push(variables.map_name);
      const coverage = coverages[variables.map_name ?? ""];
      if (!coverage) {
        throw new Error("no coverage");
      }
      return { data: { utilityLineupRenderCoverage: coverage } };
    },
  }),
}));

vi.mock("~/composables/useUtilityMaps", async () => {
  const { ref } = await import("vue");
  const tiles = ref([
    { name: "de_mirage", label: "Mirage", patch: null, poster: null },
    { name: "de_nuke", label: "Nuke", patch: null, poster: null },
  ]);
  return { useUtilityMaps: () => ({ tiles, loadMaps: async () => {} }) };
});

const auth = reactive({ me: { steam_id: "9" }, isAdmin: true });
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const mounted: Array<{ unmount: () => void }> = [];

beforeEach(() => {
  Object.assign(rows, DEFAULT_ROWS);
  for (const key of Object.keys(coverages)) {
    delete coverages[key];
  }
  coverages[""] = coverageOf();
  asked.length = 0;
  useToast().dismiss();
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const settle = async (ms = 20) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flushPromises();
};

async function mountPanel() {
  const wrapper = await mountSuspended(UtilityRenderQueuePanel, {
    attachTo: document.body,
    global: { stubs: { SnapshotQuickView: true } },
  });
  mounted.push(wrapper);
  await settle();
  return wrapper;
}

type Panel = Awaited<ReturnType<typeof mountPanel>>;

// The clock the panel reads: only Date is faked, so the subscriptions and the
// debounce still run on real timers.
const NOW = Date.parse("2026-10-09T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

function holdClock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
}

// A queued row whose history is these boot ticks, each `[stage, seconds
// ago]`, last heard from at its last tick.
function queued(
  id: string,
  mapName: string,
  ticks: Array<[string, number]>,
  extra: Record<string, unknown> = {},
) {
  const heard = ticks.length ? ticks[ticks.length - 1][1] : 600;
  return {
    ...row(id, `l-${id}`, "queued"),
    map_name: mapName,
    status_history: [
      { status: "queued", at: ago(900) },
      ...ticks.map(([stage, seconds]) => ({
        status: "booting",
        at: ago(seconds),
        boot_stage: stage,
      })),
    ],
    last_status_at: ago(heard),
    created_at: ago(900),
    ...extra,
  };
}

const queueRow = (wrapper: Panel, id: string) =>
  wrapper
    .findAll("[data-queue-row]")
    .find((item) => item.text().includes(`Lineup l-${id}`))!;

const statusOf = (wrapper: Panel, id: string) =>
  queueRow(wrapper, id).find("[data-queue-status]").text();

const stat = (wrapper: Panel, key: string) =>
  wrapper.find(`[data-coverage-stat="${key}"] dd`).text();

const bulk = (wrapper: Panel, scope: string) =>
  wrapper.find(`button[data-bulk="${scope}"]`);

const gapRow = (wrapper: Panel, id: string) =>
  wrapper
    .findAll("[data-gap]")
    .find((item) => item.find("a").text() === `Gap ${id}`);

const lastToast = () => useToast().toasts.value[0];

// As read: the markup's own line breaks are not part of what it says.
const said = (text: string) => text.replace(/\s+/g, " ").trim();

function mutations(result: (variables: any) => any) {
  return vi
    .spyOn(useNuxtApp().$apollo.defaultClient, "mutate")
    .mockImplementation((async ({ variables }: any) => ({
      data: result(variables),
    })) as any);
}

async function confirmBulk() {
  document.body
    .querySelector<HTMLButtonElement>("[data-bulk-confirm]")!
    .click();
  await settle();
}

const finishedRow = (wrapper: any, name: string) =>
  wrapper
    .findAll("li")
    .find((item: any) => item.find("a").exists() && item.find("a").text() === name);

describe("UtilityRenderQueuePanel", () => {
  it("marks the render that is the lineup's preview as live", async () => {
    const wrapper = await mountPanel();

    const live = wrapper
      .findAll("li")
      .filter((item) => item.text().includes("Live"));
    expect(live).toHaveLength(2);
    expect(live[0].find("a").text()).toBe("Lineup l-1");
    expect(
      wrapper.findAll("li").filter((item) => item.text().includes("Failed"))[0]
        .text(),
    ).not.toContain("Live");
  });

  it("holds the re-render while that lineup has one in flight", async () => {
    const wrapper = await mountPanel();

    const busy = finishedRow(wrapper, "Lineup l-2");
    const button = busy.find("button[aria-label='Re-render preview']");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.element.parentElement!.getAttribute("title")).toBe(
      "A render for this lineup is already running",
    );

    const free = finishedRow(wrapper, "Lineup l-1");
    expect(
      free.find("button[aria-label='Re-render preview']").attributes("disabled"),
    ).toBeUndefined();
  });

  it("asks before deleting the live render, and not before an old one", async () => {
    const wrapper = await mountPanel();
    const mutate = vi
      .spyOn(useNuxtApp().$apollo.defaultClient, "mutate")
      .mockResolvedValue({ data: {} } as any);

    const failed = wrapper
      .findAll("li")
      .find((item) => item.text().includes("Failed"))!;
    await failed.find("button[aria-label='Delete render']").trigger("click");
    await flushPromises();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables).toEqual({ render_id: "r-0" });
    expect(document.body.textContent).not.toContain("Delete this render?");

    await finishedRow(wrapper, "Lineup l-1")
      .find("button[aria-label='Delete render']")
      .trigger("click");
    await flushPromises();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Delete this render?");
  });
});

describe("UtilityRenderQueuePanel coverage", () => {
  it("says which render version is expected and what the library is missing", async () => {
    coverages[""] = coverageOf({
      current: 120,
      missing: 14,
      outdated: 9,
      unrenderable: 3,
      queued: 2,
    });
    const wrapper = await mountPanel();

    expect(said(wrapper.find("[data-coverage-version]").text())).toBe(
      "Render version v2",
    );
    expect(stat(wrapper, "current")).toBe("120");
    expect(stat(wrapper, "missing")).toBe("14");
    expect(stat(wrapper, "outdated")).toBe("9");
    expect(stat(wrapper, "unrenderable")).toBe("3");
    expect(stat(wrapper, "queued")).toBe("2");
    expect(wrapper.find("[data-coverage-stat='unrenderable'] dt").text()).toBe(
      "Cannot be filmed",
    );

    expect(bulk(wrapper, "missing").text()).toBe("Render Missing (14)");
    expect(bulk(wrapper, "missing").attributes("disabled")).toBeUndefined();
    expect(bulk(wrapper, "outdated").text()).toBe("Re-render Outdated (9)");
    expect(bulk(wrapper, "outdated").attributes("disabled")).toBeUndefined();
    expect(wrapper.find("[data-coverage-behind]").exists()).toBe(false);
  });

  it("holds each button when there is nothing for it to queue", async () => {
    coverages[""] = coverageOf({ missing: 0, outdated: 0, lineups: [] });
    const wrapper = await mountPanel();

    expect(bulk(wrapper, "missing").text()).toBe("Render Missing (0)");
    expect(bulk(wrapper, "missing").attributes("disabled")).toBeDefined();
    expect(bulk(wrapper, "outdated").attributes("disabled")).toBeDefined();
  });

  it("warns when the pod films an older version, and holds the re-render", async () => {
    coverages[""] = coverageOf({ pipeline_version: 1, outdated: 9 });
    const wrapper = await mountPanel();

    const warning = wrapper.find("[data-coverage-behind]");
    expect(warning.attributes("aria-label")).toContain(
      "The render pod in use films version 1, older than the version 2 this API expects",
    );
    expect(warning.attributes("aria-label")).toContain(
      "until the game-server and game-streamer images are updated",
    );
    expect(bulk(wrapper, "outdated").attributes("disabled")).toBeDefined();
    expect(bulk(wrapper, "missing").attributes("disabled")).toBeUndefined();
  });

  it("does not warn before any render has reported a version", async () => {
    coverages[""] = coverageOf({ pipeline_version: null, outdated: 9 });
    const wrapper = await mountPanel();

    expect(wrapper.find("[data-coverage-behind]").exists()).toBe(false);
    expect(bulk(wrapper, "outdated").attributes("disabled")).toBeUndefined();
  });

  it("marks the strip when what is missing could not be loaded", async () => {
    delete coverages[""];
    vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapper = await mountPanel();

    expect(
      wrapper.find("[data-coverage-failed]").attributes("aria-label"),
    ).toBe("Could not load preview coverage");
    expect(stat(wrapper, "missing")).toBe("–");
    expect(bulk(wrapper, "missing").attributes("disabled")).toBeDefined();
  });

  it("asks before queueing everything missing, then says how many it queued", async () => {
    coverages[""] = coverageOf({ missing: 14 });
    const wrapper = await mountPanel();
    const mutate = mutations(() => ({
      renderUtilityLineupPreviews: { queued: 14, skipped: 0 },
    }));

    await bulk(wrapper, "missing").trigger("click");
    await settle();
    expect(document.body.textContent).toContain("Render Missing Previews?");
    expect(document.body.textContent).toContain(
      "This queues a render for 14 lineups that have no preview.",
    );
    expect(mutate).not.toHaveBeenCalled();

    coverages[""] = coverageOf({ missing: 0, queued: 16, lineups: [] });
    await confirmBulk();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables).toEqual({
      scope: "missing",
      map_name: null,
    });
    expect(lastToast().title).toBe("Queued 14 renders");
    expect(lastToast().description).toBeUndefined();
    expect(document.body.textContent).not.toContain("Render Missing Previews?");
    expect(stat(wrapper, "missing")).toBe("0");
    expect(stat(wrapper, "queued")).toBe("16");
  });

  it("says how many are left when a press does not take them all", async () => {
    coverages[""] = coverageOf({ outdated: 420 });
    const wrapper = await mountPanel();
    const mutate = mutations(() => ({
      renderUtilityLineupPreviews: { queued: 300, skipped: 120 },
    }));

    await bulk(wrapper, "outdated").trigger("click");
    await settle();
    expect(document.body.textContent).toContain("Re-render Outdated Previews?");
    expect(document.body.textContent).toContain(
      "Each preview is replaced when its render finishes.",
    );
    await confirmBulk();

    expect(mutate.mock.calls[0][0].variables?.scope).toBe("outdated");
    expect(lastToast().title).toBe("Queued 300 renders");
    expect(lastToast().description).toBe(
      "120 were not queued this time. Press again to take the next batch.",
    );
  });

  it("says so when a press queued nothing", async () => {
    const wrapper = await mountPanel();
    mutations(() => ({
      renderUtilityLineupPreviews: { queued: 0, skipped: 1 },
    }));

    await bulk(wrapper, "missing").trigger("click");
    await settle();
    await confirmBulk();

    expect(lastToast().title).toBe("Nothing was queued");
    expect(lastToast().description).toBe(
      "1 was not queued this time. Press again to take the next batch.",
    );
  });

  it("shows the api's reason when it refuses", async () => {
    const wrapper = await mountPanel();
    vi.spyOn(useNuxtApp().$apollo.defaultClient, "mutate").mockRejectedValue(
      new Error("the render pod in use films version 1, older than version 2"),
    );

    await bulk(wrapper, "outdated").trigger("click");
    await settle();
    await confirmBulk();

    expect(lastToast().title).toBe("Could not queue those renders");
    expect(lastToast().description).toBe(
      "the render pod in use films version 1, older than version 2",
    );
    expect(lastToast().variant).toBe("destructive");
  });

  it("scopes the counts, the list and the buttons to the map picked", async () => {
    coverages["de_nuke"] = coverageOf({
      current: 30,
      missing: 4,
      outdated: 0,
      unrenderable: 1,
      lineups: [gap("g-9", "missing", { map_name: "de_nuke" }), GAPS[2]],
    });
    const wrapper = await mountPanel();
    const mutate = mutations(() => ({
      renderUtilityLineupPreviews: { queued: 4, skipped: 0 },
    }));

    wrapper.findComponent(Select).vm.$emit("update:modelValue", "de_nuke");
    await settle();

    expect(asked).toEqual([null, "de_nuke"]);
    expect(stat(wrapper, "current")).toBe("30");
    expect(bulk(wrapper, "missing").text()).toBe("Render Missing (4)");
    expect(bulk(wrapper, "outdated").attributes("disabled")).toBeDefined();
    expect(gapRow(wrapper, "g-9")).toBeDefined();
    expect(gapRow(wrapper, "g-1")).toBeUndefined();

    await bulk(wrapper, "missing").trigger("click");
    await settle();
    expect(document.body.textContent).toContain("Only lineups on Nuke.");
    await confirmBulk();

    expect(mutate.mock.calls[0][0].variables).toEqual({
      scope: "missing",
      map_name: "de_nuke",
    });
  });
});

describe("UtilityRenderQueuePanel needs-a-render list", () => {
  it("lists each lineup with its map, type and what its preview needs", async () => {
    const wrapper = await mountPanel();

    const missing = gapRow(wrapper, "g-1")!;
    expect(missing.find("a").attributes("href")).toBe(
      "/utility/de_mirage?lineup=g-1",
    );
    expect(missing.text()).toContain("Mirage");
    expect(missing.text()).toContain("Smoke");
    expect(missing.text()).toContain("Missing");

    const outdated = gapRow(wrapper, "g-2")!;
    expect(outdated.text()).toContain("Flash");
    expect(outdated.text()).toContain("Outdated");
    const version = outdated.find("[data-render-version]");
    expect(version.text()).toContain("v1");
    expect(version.attributes("title")).toBe(
      "Filmed by render version 1. Version 2 is current.",
    );

    const cannot = gapRow(wrapper, "g-3")!;
    expect(cannot.text()).toContain("Nuke");
    expect(cannot.text()).toContain("Cannot be filmed");
    expect(cannot.find("[data-render-warn]").attributes("aria-label")).toBe(
      "Cannot be filmed. it has no physics seed",
    );
  });

  it("offers a render for what can be filmed, and none for what cannot", async () => {
    const wrapper = await mountPanel();

    expect(
      gapRow(wrapper, "g-1")!
        .find("button[aria-label='Render preview']")
        .exists(),
    ).toBe(true);
    expect(
      gapRow(wrapper, "g-2")!
        .find("button[aria-label='Re-render preview']")
        .exists(),
    ).toBe(true);
    expect(gapRow(wrapper, "g-3")!.find("button").exists()).toBe(false);
  });

  it("queues the one lineup, and drops it from the list once it is in the queue", async () => {
    const wrapper = await mountPanel();
    const mutate = mutations(() => ({
      renderUtilityLineupPreview: { success: true, render_id: "r-new" },
    }));

    coverages[""] = coverageOf({
      missing: 0,
      queued: 3,
      lineups: [GAPS[1], GAPS[2]],
    });
    await gapRow(wrapper, "g-1")!
      .find("button[aria-label='Render preview']")
      .trigger("click");
    await settle();

    expect(mutate.mock.calls[0][0].variables).toEqual({
      utility_lineup_id: "g-1",
    });
    expect(lastToast().title).toBe("Preview render queued");
    expect(gapRow(wrapper, "g-1")).toBeUndefined();
    expect(gapRow(wrapper, "g-2")).toBeDefined();
    expect(stat(wrapper, "queued")).toBe("3");
  });

  it("says why when the api turns the render down", async () => {
    const wrapper = await mountPanel();
    mutations(() => ({
      renderUtilityLineupPreview: {
        success: false,
        reason: "a render for this lineup is already running",
      },
    }));

    await gapRow(wrapper, "g-2")!
      .find("button[aria-label='Re-render preview']")
      .trigger("click");
    await settle();

    expect(lastToast().title).toBe("Could not queue that render");
    expect(lastToast().description).toBe(
      "a render for this lineup is already running",
    );
  });

  it("narrows to one state", async () => {
    const wrapper = await mountPanel();
    const tab = wrapper
      .find("[data-render-gaps]")
      .findAll("button")
      .find((button) => button.text().startsWith("Outdated"))!;

    expect(tab.text()).toBe("Outdated1");
    await tab.trigger("click");
    await settle();

    expect(
      wrapper.findAll("[data-gap]").map((item) => item.find("a").text()),
    ).toEqual(["Gap g-2"]);
  });

  it("says when the api listed fewer than it counted", async () => {
    coverages[""] = coverageOf({ missing: 700, outdated: 90 });
    const wrapper = await mountPanel();

    expect(wrapper.find("[data-gaps-capped]").text()).toBe(
      "Showing the first 3 of 791.",
    );
  });

  it("says nothing of the sort when the list is all there is", async () => {
    const wrapper = await mountPanel();

    expect(wrapper.find("[data-gaps-capped]").exists()).toBe(false);
  });

  it("says so when every preview is up to date", async () => {
    coverages[""] = coverageOf({
      missing: 0,
      outdated: 0,
      unrenderable: 0,
      lineups: [],
    });
    const wrapper = await mountPanel();

    expect(wrapper.find("[data-render-gaps]").text()).toContain(
      "Every preview is up to date.",
    );
  });
});

describe("UtilityRenderQueuePanel coverage refresh", () => {
  it("asks again a moment after a render leaves the queue", async () => {
    const wrapper = await mountPanel();
    expect(asked).toHaveLength(1);

    rows.inFlight = [];
    rows.finished = [
      row("r-9", "l-2", "done", `${CDN}/l-2/r-9.mp4`),
      ...DEFAULT_ROWS.finished,
    ];
    coverages[""] = coverageOf({ current: 121, queued: 1 });
    feed.inFlight();
    feed.finished();
    await settle(100);
    expect(asked).toHaveLength(1);

    await settle(1700);
    expect(asked).toHaveLength(2);
    expect(stat(wrapper, "current")).toBe("121");
  });

  it("does not ask again for a render that only moved on a few percent", async () => {
    await mountPanel();

    rows.inFlight = [{ ...row("r-9", "l-2", "rendering"), progress: 0.6 }];
    feed.inFlight();
    await settle(1700);

    expect(asked).toHaveLength(1);
  });

  it("asks again after a finished render is sent back to the queue", async () => {
    const wrapper = await mountPanel();
    mutations(() => ({ renderUtilityLineupPreview: { success: true } }));

    await finishedRow(wrapper, "Lineup l-1")
      .find("button[aria-label='Re-render preview']")
      .trigger("click");
    await settle();

    expect(asked).toHaveLength(2);
  });
});

describe("UtilityRenderQueuePanel queue", () => {
  beforeEach(holdClock);

  it("is one queue, map by map, starting with the map the pod is on", async () => {
    rows.inFlight = [
      queued("a-1", "de_ancient", [["waiting_for_map", 300]]),
      queued("n-1", "de_nuke", [["waiting_for_map", 300]]),
      {
        ...queued("m-1", "de_mirage", [["connecting_to_game", 120]]),
        status: "rendering",
        progress: 0.4,
        k8s_job_name: "gs-nades-queue",
        last_status_at: ago(3),
      },
      queued("m-2", "de_mirage", [
        ["dispatching_pod", 200],
        ["waiting_turn", 60],
      ]),
    ];
    const wrapper = await mountPanel();

    expect(wrapper.findAll("[data-render-queue]")).toHaveLength(1);
    expect(said(wrapper.find("[data-render-queue]").text())).toContain(
      "Render pod 4 lineups / 3 maps",
    );
    const maps = wrapper.findAll("[data-queue-map]");
    expect(maps.map((map) => map.text())).toEqual([
      "Mirage2 lineups",
      "Ancient1 lineup",
      "Nuke1 lineup",
    ]);
    expect(maps[0].find("[data-queue-here]").attributes("aria-label")).toBe(
      "The render pod is on this map",
    );
    expect(maps[1].find("[data-queue-here]").exists()).toBe(false);
  });

  it("says on each queued row what that row is waiting on", async () => {
    rows.inFlight = [
      {
        ...queued("m-1", "de_mirage", [["connecting_to_game", 120]]),
        status: "rendering",
        progress: 0.4,
        k8s_job_name: "gs-nades-queue",
        last_status_at: ago(3),
      },
      queued("m-2", "de_mirage", [
        ["dispatching_pod", 200],
        ["waiting_turn", 60],
      ]),
      queued("m-3", "de_mirage", [["connecting_to_game", 120]], {
        k8s_job_name: "gs-nades-queue",
      }),
      queued("n-1", "de_nuke", [["waiting_for_map", 300]]),
      queued("x-1", "de_ancient", [["defragmenting_disk", 30]]),
      queued("x-2", "de_ancient", []),
    ];
    const wrapper = await mountPanel();

    expect(statusOf(wrapper, "m-1")).toBe("Filming");
    expect(statusOf(wrapper, "m-2")).toBe("Waiting its turn");
    expect(statusOf(wrapper, "m-3")).toBe("Waiting its turn");
    expect(statusOf(wrapper, "n-1")).toBe("Waiting for its map");
    expect(statusOf(wrapper, "x-1")).toBe("Queued");
    expect(statusOf(wrapper, "x-2")).toBe("Queued");
  });

  it("names the map the server is changing to, on the rows going there", async () => {
    rows.inFlight = [
      queued("n-1", "de_nuke", [
        ["waiting_for_map", 300],
        ["changing_map:de_nuke", 20],
      ]),
      queued("a-1", "de_ancient", [["waiting_for_map", 300]]),
    ];
    const wrapper = await mountPanel();

    expect(statusOf(wrapper, "n-1")).toBe("Changing map to Nuke");
    expect(statusOf(wrapper, "a-1")).toBe("Waiting for its map");
    expect(
      wrapper.findAll("[data-queue-map]").map((map) => map.text()),
    ).toEqual(["Nuke1 lineup", "Ancient1 lineup"]);
    expect(wrapper.find("[data-queue-unclaimed]").exists()).toBe(false);
  });

  it("shows the boot on the rows being booked, and no waits in the stepper", async () => {
    rows.inFlight = [
      queued("m-1", "de_mirage", [
        ["booking_server", 90],
        ["server_starting:WaitingForPing", 30],
      ]),
      queued("n-1", "de_nuke", [["waiting_for_map", 20]]),
    ];
    const wrapper = await mountPanel();

    expect(statusOf(wrapper, "m-1")).toBe(
      "Practice server starting · WaitingForPing",
    );
    expect(statusOf(wrapper, "n-1")).toBe("Waiting for its map");

    const steps = wrapper
      .find("[data-render-queue] ul")
      .findAll("li")
      .map((step) => step.text());
    expect(steps[0]).toContain("Booking a practice server");
    expect(steps[1]).toContain("Practice server starting");
    expect(steps.join(" ")).not.toContain("Waiting");
    expect(steps.join(" ")).not.toContain("Changing map");
    expect(steps.join(" ")).not.toContain("skipped");
    expect(
      wrapper.find("[data-render-queue] ul li.line-through").exists(),
    ).toBe(false);
  });

  it("tells a wait apart from the boot in how a row got here", async () => {
    rows.inFlight = [
      queued("n-1", "de_nuke", [
        ["waiting_for_map", 600],
        ["changing_map:de_nuke", 20],
      ]),
    ];
    const wrapper = await mountPanel();

    const text = queueRow(wrapper, "n-1").text();
    expect(text).toContain("Waiting for its map 9m");
    expect(text).toContain("Changing map 20s");
    expect(text).not.toContain("Render pod booting");
  });

  it("marks a row as gone quiet only where silence means something", async () => {
    rows.inFlight = [
      {
        ...queued("m-1", "de_mirage", []),
        status: "rendering",
        k8s_job_name: "gs-nades-queue",
        last_status_at: ago(120),
      },
      queued("m-2", "de_mirage", [["waiting_turn", 3600]]),
      queued("n-1", "de_nuke", [["waiting_for_map", 3600]]),
    ];
    const wrapper = await mountPanel();

    expect(
      queueRow(wrapper, "m-1").find("[data-queue-stale]").attributes(
        "aria-label",
      ),
    ).toBe("Silent for 2m");
    expect(queueRow(wrapper, "m-2").find("[data-queue-stale]").exists()).toBe(
      false,
    );
    expect(queueRow(wrapper, "n-1").find("[data-queue-stale]").exists()).toBe(
      false,
    );
    expect(statusOf(wrapper, "m-2")).toBe("Waiting its turn");
    expect(statusOf(wrapper, "n-1")).toBe("Waiting for its map");
  });

  it("gives a map change five minutes before marking it", async () => {
    rows.inFlight = [
      queued("n-1", "de_nuke", [["changing_map:de_nuke", 120]]),
    ];
    const wrapper = await mountPanel();
    expect(queueRow(wrapper, "n-1").find("[data-queue-stale]").exists()).toBe(
      false,
    );
    wrapper.unmount();

    rows.inFlight = [
      queued("n-2", "de_nuke", [["changing_map:de_nuke", 360]]),
    ];
    const later = await mountPanel();
    expect(
      queueRow(later, "n-2").find("[data-queue-stale]").attributes(
        "aria-label",
      ),
    ).toBe("Silent for 6m");
    expect(statusOf(later, "n-2")).toBe("Changing map to Nuke");
  });

  it("says when nothing has picked the queue up", async () => {
    rows.inFlight = [queued("m-1", "de_mirage", [])];
    const wrapper = await mountPanel();

    expect(
      wrapper.find("[data-queue-unclaimed]").attributes("aria-label"),
    ).toContain("No pod dispatched yet");
    expect(statusOf(wrapper, "m-1")).toBe("Queued");
  });
});

describe("UtilityRenderQueuePanel finished renders", () => {
  const versionOf = (wrapper: Panel, name: string) =>
    finishedRow(wrapper, name).find("[data-render-version]");

  it("shows the version each finished render was filmed by", async () => {
    rows.finished = [
      { ...row("r-1", "l-1", "done"), render_version: 2 },
      { ...row("r-2", "l-2", "done"), render_version: 1 },
      { ...row("r-3", "l-3", "done"), render_version: 0 },
      { ...row("r-4", "l-4", "done"), render_version: null },
      { ...row("r-5", "l-5", "error"), render_version: null },
    ];
    const wrapper = await mountPanel();

    const current = versionOf(wrapper, "Lineup l-1");
    expect(current.text()).toBe("v2");
    expect(current.attributes("data-outdated")).toBeUndefined();
    expect(current.attributes("title")).toBeUndefined();

    const older = versionOf(wrapper, "Lineup l-2");
    expect(older.text()).toContain("v1");
    expect(older.attributes("data-outdated")).toBeDefined();
    expect(older.attributes("title")).toBe(
      "Filmed by render version 1. Version 2 is current.",
    );

    for (const name of ["Lineup l-3", "Lineup l-4"]) {
      const unreported = versionOf(wrapper, name);
      expect(unreported.text()).toContain("v0");
      expect(unreported.attributes("data-outdated")).toBeDefined();
      expect(unreported.attributes("title")).toContain(
        "No render version reported",
      );
    }

    expect(versionOf(wrapper, "Lineup l-5").exists()).toBe(false);
  });
});
