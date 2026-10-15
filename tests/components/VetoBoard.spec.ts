import { describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import VetoBoard from "~/components/match/VetoBoard.vue";
import { mapVetoOrder } from "~/utilities/vetoOrder";
import type { VetoBoardLineup, VetoBoardStep } from "~/utilities/vetoOrder";
import type { ScoutLineup } from "~/utilities/vetoScouting";

const MAPS = [
  "ancient",
  "anubis",
  "dust2",
  "inferno",
  "mirage",
  "nuke",
  "train",
];

const items = MAPS.map((id) => ({ id, label: id, poster: null, patch: null }));
const lineups: [VetoBoardLineup, VetoBoardLineup] = [
  { name: "Buttah Boyz", crest: null, monogram: "BB" },
  { name: "Night Owls", crest: null, monogram: "NO" },
];

// Steps of a best of three with the first `done` moves made.
function steps(done: string[]): VetoBoardStep[] {
  return mapVetoOrder(3, MAPS.length).map((step, index) => ({
    ...step,
    record: done[index]
      ? { itemId: done[index], lineup: step.lineup, side: null, auto: false }
      : null,
  }));
}

const scout = (
  owner: string,
  maps: Record<string, Partial<ScoutLineup["maps"][string]>>,
): ScoutLineup => ({
  source: "team",
  owner,
  vetoes: 10,
  maps: Object.fromEntries(
    Object.entries(maps).map(([id, map]) => [
      id,
      { wins: 0, played: 0, bans: 0, picks: 0, ...map },
    ]),
  ),
});

const scouting = {
  lineups: [
    scout("Buttah Boyz", {
      mirage: { wins: 9, played: 12 },
      nuke: { wins: 2, played: 10 },
      dust2: { wins: 5, played: 10 },
      inferno: { wins: 2, played: 2 },
    }),
    scout("Night Owls", {
      mirage: { wins: 5, played: 10 },
      nuke: { wins: 7, played: 9, picks: 7 },
      dust2: { wins: 6, played: 11 },
      inferno: { wins: 5, played: 10 },
      train: { bans: 9 },
    }),
  ] as [ScoutLineup, ScoutLineup],
  viewer: 1 as const,
};

function mount(
  props: { steps: ReturnType<typeof steps> } & Record<string, unknown>,
) {
  return mountSuspended(VetoBoard, {
    props: {
      kind: "map",
      items,
      lineups,
      bestOf: 3,
      scouting,
      ...props,
    },
  });
}

const slice = (wrapper: any, id: string) => wrapper.find(`[data-item="${id}"]`);

describe("VetoBoard scouting", () => {
  it("shows the edge and their habits on the open maps", async () => {
    const wrapper = await mount({
      steps: steps([]),
      pickingLineup: 1,
      isPicking: true,
    });

    const edge = (id: string) => slice(wrapper, id).find(".vb-edge");
    // 75% against 50%: yours, by 25. No crest: the sign says whose.
    expect(edge("mirage").text()).toBe("+25");
    expect(edge("mirage").attributes("data-tone")).toBe("you");
    // 20% against 78%: theirs, so it counts against you.
    expect(edge("nuke").text()).toBe("−58");
    expect(edge("nuke").attributes("data-tone")).toBe("them");
    // 50% against 55%: within five points.
    expect(edge("dust2").text()).toBe("+0");
    // Two games are too few for a rate.
    expect(edge("inferno").text()).toBe("—");

    expect(wrapper.find(".vb-scoutkey").text()).toContain("Edge");
    expect(slice(wrapper, "train").find(".vb-habit").text()).toContain(
      "Usually bans",
    );
    expect(slice(wrapper, "nuke").find(".vb-habit").text()).toContain(
      "Usually picks",
    );
    // It is your turn, so nothing guesses at your move.
    expect(wrapper.find(".vb-likely").exists()).toBe(false);
  });

  it("names the stronger side by its crest when you are watching", async () => {
    const wrapper = await mount({
      steps: steps([]),
      pickingLineup: 1,
      isPicking: false,
      scouting: { ...scouting, viewer: null },
    });

    const nuke = slice(wrapper, "nuke").find(".vb-edge");
    expect(nuke.text()).toMatch(/^NO\s*\+58$/);
    expect(nuke.attributes("data-tone")).toBe("side");
  });

  it("keeps the key line while the history loads", async () => {
    const wrapper = await mount({
      steps: steps([]),
      pickingLineup: 1,
      isPicking: true,
      scouting: { lineups: [null, null], viewer: 1 },
    });

    expect(wrapper.find(".vb-scoutkey").exists()).toBe(true);
    expect(wrapper.find(".vb-edge").exists()).toBe(false);
  });

  it("outlines their likely move while they are on the clock", async () => {
    const wrapper = await mount({
      steps: steps(["ancient"]),
      pickingLineup: 2,
      isPicking: false,
    });

    const train = slice(wrapper, "train");
    expect(train.find(".vb-likely").exists()).toBe(true);
    expect(train.find(".vb-habit").text()).toContain("Likely ban");
  });

  it("puts both records on the map you choose", async () => {
    const wrapper = await mount({
      steps: steps([]),
      pickingLineup: 1,
      isPicking: true,
    });

    await slice(wrapper, "mirage").trigger("click");

    const rows = slice(wrapper, "mirage").findAll(".vb-rec");
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("You");
    expect(rows[0].text()).toContain("9–3");
    expect(rows[1].text()).toContain("Night Owls");
    expect(rows[1].text()).toContain("5–5");
  });

  it("is the plain board when scouting is off", async () => {
    const wrapper = await mount({
      steps: steps([]),
      pickingLineup: 1,
      isPicking: true,
      scouting: null,
    });

    expect(wrapper.find(".vb-scoutkey").exists()).toBe(false);
    expect(wrapper.find(".vb-edge").exists()).toBe(false);
    expect(wrapper.find(".vb-habit").exists()).toBe(false);
  });
});

describe("VetoBoard keys", () => {
  it("walks the open maps with the arrows and shows the hint", async () => {
    const wrapper = await mount({
      steps: steps([]),
      pickingLineup: 1,
      isPicking: true,
      scouting: null,
    });

    await wrapper.find(".vb-stage").trigger("keydown", { key: "ArrowRight" });

    expect(slice(wrapper, "ancient").classes()).toContain("is-wide");
    expect(wrapper.find(".vb-keys").exists()).toBe(true);

    await wrapper.find(".vb-stage").trigger("keydown", { key: "ArrowRight" });
    expect(slice(wrapper, "ancient").classes()).not.toContain("is-wide");
    expect(slice(wrapper, "anubis").classes()).toContain("is-wide");

    await wrapper.find(".vb-stage").trigger("keydown", { key: "Escape" });
    expect(slice(wrapper, "anubis").classes()).not.toContain("is-wide");
  });
});

describe("VetoBoard your moves", () => {
  it("lifts your moves and names your turn on the rail", async () => {
    // Two bans in: Buttah Boyz (1) banned, Night Owls (2) banned, now 1 picks.
    const wrapper = await mount({
      steps: steps(["train", "dust2"]),
      pickingLineup: 1,
      isPicking: true,
      viewer: 1,
      scouting: null,
    });

    const rail = wrapper.findAll(".vb-railstep");
    expect(rail[0].classes()).toContain("is-mine");
    expect(rail[1].classes()).not.toContain("is-mine");
    expect(rail[2].text()).toBe("Your pick");
  });

  it("lays the order of play out as a ledger for phones", async () => {
    // Night Owls (2) chose T on the Mirage that Buttah Boyz picked.
    const done = steps(["train", "dust2", "mirage", "mirage"]);
    done[3].record = { itemId: "mirage", lineup: 2, side: "T", auto: false };
    const wrapper = await mount({
      steps: done,
      pickingLineup: 2,
      isPicking: false,
      viewer: 2,
      scouting: null,
    });

    const rows = wrapper.findAll(".vb-ledger .vb-lrow");
    expect(rows).toHaveLength(2);
    // Lineup 1 bans, picks, chooses a side, bans; lineup 2 the mirror.
    expect(rows[0].findAll(".vb-tok")).toHaveLength(4);
    expect(rows[1].find(".vb-lwho").classes()).toContain("is-mine");
    expect(rows[1].findAll(".vb-tok")[1].text()).toContain("T");
    expect(wrapper.find(".vb-ldec").text()).toContain("Decider");
  });
});

describe("VetoBoard start", () => {
  // A best of three done: Mirage picked by Buttah Boyz (1), Nuke by Night
  // Owls (2), Ancient left as the decider.
  const done = steps([
    "train",
    "dust2",
    "mirage",
    "mirage",
    "nuke",
    "nuke",
    "anubis",
    "inferno",
    "ancient",
  ]);
  const maps = [
    {
      itemId: "mirage",
      decider: false,
      pickedBy: 1 as const,
      sides: { 1: "T" as const, 2: "CT" as const },
    },
    {
      itemId: "nuke",
      decider: false,
      pickedBy: 2 as const,
      sides: { 1: "CT" as const, 2: "T" as const },
    },
    { itemId: "ancient", decider: true, pickedBy: null, sides: null },
  ];

  it("grows the series into the maps with the side each team starts on", async () => {
    const wrapper = await mount({
      steps: done,
      viewer: 1,
      scouting: null,
      start: { phase: "booting", maps },
    });

    expect(wrapper.find(".vb-lead").text()).toBe("Server booting");
    expect(wrapper.find(".st-area").classes()).toContain("is-starting");
    expect(wrapper.find(".vb-scoutkey").text()).toContain("Starting sides");
    expect(wrapper.find(".vb-scoutkey").text()).toContain("knife round");

    const panels = wrapper.findAll(".st-panel");
    expect(panels).toHaveLength(3);
    expect(panels[0].find(".top .n").text()).toBe("Map 1");
    expect(panels[2].find(".top .n").text()).toBe("Decider · Map 3");

    // Your plate wears the You pill; theirs does not.
    const plates = panels[0].findAll(".plate");
    expect(plates[0].attributes("data-side")).toBe("T");
    expect(plates[0].find(".you").exists()).toBe(true);
    expect(plates[1].attributes("data-side")).toBe("CT");
    expect(plates[1].find(".you").exists()).toBe(false);

    expect(panels[2].find(".plate.is-knife").text()).toContain("Knife round");
  });

  it("names the first map and your side, then hands the maps over", async () => {
    const wrapper = await mount({
      steps: done,
      viewer: 1,
      scouting: null,
      start: { phase: "booting", maps },
      handOff: true,
    });

    vi.useFakeTimers();
    try {
      await wrapper.setProps({ start: { phase: "ready", maps } });
      expect(wrapper.find(".vb-lead").text()).toBe("Server ready");
      expect(wrapper.find(".vb-line").text()).toBe(
        "mirage first · you start T",
      );

      vi.advanceTimersByTime(1000);
      const [[flight]] = wrapper.emitted("handoff") as [[any]];
      expect(flight.maps.map((map: any) => map.home)).toEqual([
        "map-1",
        "map-2",
        "map-3",
      ]);
      expect(flight.rail).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not call the only map of a best of one first", async () => {
    const wrapper = await mount({
      steps: done,
      viewer: 2,
      scouting: null,
      bestOf: 1,
      start: { phase: "ready", maps: [maps[0]] },
    });

    expect(wrapper.find(".vb-line").text()).toBe("mirage · you start CT");
    expect(wrapper.find(".st-panel .top .n").text()).toBe("The map");
  });
});
