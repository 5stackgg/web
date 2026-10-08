import { describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import Cs2BuildCard from "~/components/game-server-nodes/Cs2BuildCard.vue";
import Cs2GamedataPanel from "~/components/game-server-nodes/Cs2GamedataPanel.vue";
import Cs2MapAssetsPanel from "~/components/game-server-nodes/Cs2MapAssetsPanel.vue";
import type {
  Cs2BuildNode,
  GamedataRunRow,
  MapAssetsRunRow,
} from "~/types/cs2Build";

const runs = vi.hoisted(() => ({
  gamedata: null as GamedataRunRow | null,
  mapAssets: null as MapAssetsRunRow | null,
}));

vi.mock("~/composables/useCs2BuildRuns", async () => {
  const { ref } = await import("vue");
  return {
    useCs2BuildRuns: () => ({
      gamedata: ref(runs.gamedata),
      mapAssets: ref(runs.mapAssets),
      loaded: ref(true),
    }),
    useCs2BuildNodes: () => ({ nodes: ref([]) }),
  };
});

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

const nodes: Array<Cs2BuildNode> = [
  {
    id: "node-a",
    label: "EU West",
    status: "Online",
    enabled: true,
    build_id: 25537370,
    update_status: null,
    gpu: false,
    enabled_for_match_making: true,
    e_region: { description: "Europe" },
  },
  {
    id: "node-b",
    label: null,
    status: "Online",
    enabled: true,
    build_id: 25400000,
    update_status: null,
    gpu: false,
    enabled_for_match_making: true,
  },
];

const change = (signature: string, previous: number, count: number) => ({
  set: "fivestack",
  kind: "signature",
  signature,
  runtimes: ["swiftlys2", "counterstrikesharp"],
  previous_count: previous,
  count,
});

const gamedata: GamedataRunRow = {
  id: "row",
  build_id: 25537370,
  status: "fail",
  started_at: minutesAgo(20),
  validated_at: minutesAgo(16),
  trigger: "manual",
  previous_build_id: 25400000,
  requested_by: { steam_id: "76561198000000001", name: "Luke" },
  game_server_node: { id: "node-a", label: "EU West" },
  changes: {
    comparable: true,
    counts: { checked: 212, broken: 2, warnings: 1, skipped: 16 },
    newly_broken: [change("ConnectClient", 1, 0)],
    fixed: [change("GetAddonName", 0, 1)],
    new_warnings: [],
    cleared_warnings: [],
  },
  results: {
    broken: [
      { set: "fivestack", signature: "ConnectClient", kind: "signature" },
      { set: "upstream-ccs", signature: "OldBreak", kind: "vtable" },
    ],
    skipped: [
      {
        set: "upstream-swiftly",
        signature: "CServerSideClientBase::m_nSignonState",
        reason: "member offset",
      },
    ],
  },
};

const mapAssets: MapAssetsRunRow = {
  build_id: "25537370",
  status: "Published",
  started_at: minutesAgo(40),
  finished_at: minutesAgo(27),
  created_at: minutesAgo(41),
  updated_at: minutesAgo(27),
  trigger: "auto",
  previous_build_id: "25400000",
  game_server_node: { id: "node-a", label: "EU West" },
  requested_by: null,
  manifest: "25537370/manifest.json",
  failed: [],
  failed_view: [],
  error: null,
  maps: {
    de_ancient: { tri: "25400000/de_ancient.tri.gz" },
    de_mirage: { tri: "25537370/de_mirage.tri.gz" },
    rush_001: { tri: "25537370/rush_001.tri.gz", view: "x" },
  },
  changes: {
    comparable: true,
    total: 3,
    added: ["rush_001"],
    removed: [],
    rebuilt: [{ map: "de_mirage", reason: "vpk", assets: ["tri"] }],
    unchanged: 1,
  },
};

describe("CS2 build panels", () => {
  it("shows what broke and what was fixed since the previous build", async () => {
    const wrapper = await mountSuspended(Cs2GamedataPanel, {
      props: {
        buildId: 25537370,
        row: gamedata,
        nodes,
        canRun: true,
        detailed: true,
      },
    });
    const text = wrapper.text();

    expect(text).toContain("Failed");
    expect(text).toContain("Changes vs 25400000");
    expect(text).toContain("1 newly broken");
    expect(text).toContain("ConnectClient");
    expect(text).toContain("Still broken");
    expect(text).toContain("OldBreak");
    expect(text).toContain("GetAddonName");
    expect(text).toContain("by Luke");
    expect(text).toContain("ran on EU West");
    expect(text).toContain("took 4m 0s");
    expect(text).toContain("1 skipped — could not be checked");
    expect(text).toContain("Re-validate");
  });

  it("blocks a second validation while one runs", async () => {
    const wrapper = await mountSuspended(Cs2GamedataPanel, {
      props: {
        buildId: 25537370,
        row: {
          ...gamedata,
          status: "running",
          started_at: minutesAgo(1),
          validated_at: null,
          changes: null,
          results: null,
        },
        nodes,
        canRun: true,
      },
    });

    expect(wrapper.text()).toContain("Validating");
    expect(wrapper.text()).not.toContain("A validation is already running");
    expect(wrapper.find("button").attributes("disabled")).toBeDefined();
  });

  it("lists the warnings a build still has when none are new", async () => {
    const wrapper = await mountSuspended(Cs2GamedataPanel, {
      props: {
        buildId: 25537370,
        row: {
          ...gamedata,
          status: "pass",
          changes: {
            comparable: true,
            counts: { checked: 212, broken: 0, warnings: 1, skipped: 0 },
            newly_broken: [],
            fixed: [],
            new_warnings: [],
            cleared_warnings: [],
          },
          results: {
            warnings: [
              { set: "upstream-swiftly", signature: "CBaseEntity_Use", count: 2 },
            ],
          },
        },
        nodes,
        canRun: true,
      },
    });
    const text = wrapper.text();

    expect(text).toContain("warnings +0");
    expect(text).toContain("CBaseEntity_Use");
    expect(text).not.toContain("No changes since 25400000");
  });

  it("hides the last result while a re-run is in progress", async () => {
    const wrapper = await mountSuspended(Cs2GamedataPanel, {
      props: {
        buildId: 25537370,
        row: {
          ...gamedata,
          status: "running",
          started_at: minutesAgo(1),
          validated_at: null,
        },
        nodes,
        canRun: true,
      },
    });

    expect(wrapper.text()).not.toContain("ConnectClient");
    expect(wrapper.text()).not.toContain("1 newly broken");
    expect(wrapper.text()).toContain("Changes show up when this run finishes");
    expect(wrapper.text()).not.toContain("Nothing to compare with yet");
  });

  it("hides the last build's maps while a rebuild runs", async () => {
    const wrapper = await mountSuspended(Cs2MapAssetsPanel, {
      props: {
        buildId: 25537370,
        row: {
          ...mapAssets,
          status: "Building",
          started_at: minutesAgo(1),
          finished_at: null,
        },
        nodes,
        canRun: true,
      },
    });
    const text = wrapper.text();

    expect(text).toContain("Changes show up when this run finishes");
    expect(text).not.toContain("Nothing to compare with yet");
    expect(text).not.toContain("Changes vs 25400000");
    expect(text).not.toContain("1 rebuilt");
    expect(text).not.toContain("de_mirage");
  });

  it("lists every map, changed ones first", async () => {
    const wrapper = await mountSuspended(Cs2MapAssetsPanel, {
      props: { buildId: 25537370, row: mapAssets, nodes, canRun: true },
    });
    const text = wrapper.text();

    expect(text).toContain("Published");
    expect(text.indexOf("de_mirage")).toBeLessThan(text.indexOf("de_ancient"));
    expect(text).toContain("Map changed");
    expect(text).toContain("reused from 25400000");
    expect(text).toContain("25537370/manifest.json");
    expect(text).toContain("Rebuild");
  });

  it("offers to build a build that has none yet", async () => {
    const wrapper = await mountSuspended(Cs2MapAssetsPanel, {
      props: { buildId: 25537370, row: null, nodes, canRun: true },
    });

    expect(wrapper.text()).toContain("Not built");
    expect(wrapper.text()).toContain("Build");
  });

  it("disables the run when no node is on the build", async () => {
    const wrapper = await mountSuspended(Cs2MapAssetsPanel, {
      props: {
        buildId: 25537370,
        row: null,
        nodes: [nodes[1]],
        canRun: true,
      },
    });

    expect(wrapper.find("button").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).not.toContain("No online node is on build");
  });

  it("disables a rebuild while one is building without a note under it", async () => {
    const wrapper = await mountSuspended(Cs2MapAssetsPanel, {
      props: {
        buildId: 25537370,
        row: {
          ...mapAssets,
          status: "Building",
          started_at: minutesAgo(1),
          finished_at: null,
        },
        nodes,
        canRun: true,
      },
    });

    expect(wrapper.text()).toContain("Building");
    expect(wrapper.text()).not.toContain("A build is already queued or running");
    expect(wrapper.find("button").attributes("disabled")).toBeDefined();
  });
});

describe("CS2 build card", () => {
  const mountCard = () =>
    mountSuspended(Cs2BuildCard, {
      props: {
        currentVersion: {
          build_id: 25537370,
          version: "public",
          updated_at: minutesAgo(18),
        },
      },
    });

  it("starts folded behind one status, the worst of both jobs", async () => {
    useRuntimeConfig().public.webDomain = "5stack.gg";
    runs.gamedata = {
      ...gamedata,
      status: "pass",
      changes: {
        ...gamedata.changes!,
        counts: { checked: 137, broken: 0, warnings: 14, skipped: 115 },
      },
    };
    runs.mapAssets = { ...mapAssets, status: "Building", finished_at: null };

    const wrapper = await mountCard();
    const toggle = wrapper.get("button[aria-expanded]");
    const text = wrapper.text();

    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(text).toContain("Needs attention");
    expect(wrapper.find(".animate-ping").exists()).toBe(true);
    expect(text).not.toContain("25537370");
    expect(text).not.toContain("Re-validate");

    await toggle.trigger("click");

    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(wrapper.text()).toContain("25537370");
    expect(wrapper.text()).toContain("Re-validate");
  });

  it("calls a failed job out over everything else", async () => {
    useRuntimeConfig().public.webDomain = "5stack.gg";
    runs.gamedata = gamedata;
    runs.mapAssets = mapAssets;

    const wrapper = await mountCard();

    expect(wrapper.text()).toContain("Failed");
    expect(wrapper.find(".animate-ping").exists()).toBe(false);
  });
});
