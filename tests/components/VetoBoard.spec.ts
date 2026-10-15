import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
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

describe("VetoBoard choosing", () => {
  it("arms a map on a click and picks it on a second", async () => {
    const wrapper = await mount({
      steps: steps(["train", "dust2"]),
      pickingLineup: 1,
      isPicking: true,
    });

    await slice(wrapper, "mirage").trigger("click");
    expect(slice(wrapper, "mirage").classes()).toContain("is-selected");
    expect(slice(wrapper, "mirage").find(".vb-arm").exists()).toBe(true);
    expect(wrapper.find(".vb-line").text()).toBe(
      "Click mirage again to pick it · Esc to cancel",
    );
    // Its records stay up while it is armed.
    expect(slice(wrapper, "mirage").findAll(".vb-rec")).toHaveLength(2);
    expect(wrapper.emitted("confirm")).toBeUndefined();

    await slice(wrapper, "mirage").trigger("click");
    expect(wrapper.emitted("confirm")).toEqual([[{ itemId: "mirage" }]]);
  });

  it("lets a chosen map go on a click off the board", async () => {
    const wrapper = await mount({
      steps: steps(["train", "dust2"]),
      pickingLineup: 1,
      isPicking: true,
      scouting: null,
    });

    await slice(wrapper, "mirage").trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await nextTick();

    expect(slice(wrapper, "mirage").classes()).not.toContain("is-selected");
    expect(wrapper.find(".vb-line").text()).toBe(
      "Pick a map · click one twice to pick it",
    );
  });

  it("keeps a sent map armed until its move lands, even if the turn passes first", async () => {
    const wrapper = await mount({
      steps: steps(["train"]),
      pickingLineup: 2,
      isPicking: true,
      scouting: null,
    });

    await slice(wrapper, "dust2").trigger("click");
    await slice(wrapper, "dust2").trigger("click");
    expect(wrapper.emitted("confirm")).toEqual([[{ itemId: "dust2" }]]);

    // The turn passes before the ban itself arrives.
    await wrapper.setProps({ submitting: true });
    await wrapper.setProps({ isPicking: false, pickingLineup: 1 });
    expect(slice(wrapper, "dust2").classes()).toContain("is-selected");
    expect(slice(wrapper, "dust2").classes()).toContain("is-wide");
    expect(slice(wrapper, "dust2").find(".vb-arm").exists()).toBe(true);

    // Then it lands, straight into its replay.
    await wrapper.setProps({
      steps: steps(["train", "dust2"]),
      submitting: false,
    });
    expect(slice(wrapper, "dust2").find(".vb-arm").exists()).toBe(false);
    expect(slice(wrapper, "dust2").classes()).toContain("is-wide");
    expect(slice(wrapper, "dust2").attributes("data-status")).toBe("Ban");
  });

  it("mounts with a map already open, as on a page opened mid-veto", async () => {
    const wrapper = await mount({
      steps: steps(["train", "dust2", "mirage"]),
      pickingLineup: 2,
      isPicking: true,
      scouting: null,
    });

    expect(wrapper.find(".vb-split").exists()).toBe(true);
    expect(wrapper.find(".vb-sidehead").text()).toContain("mirage");
  });

  it("shows the move's mark on the map you hover, and lights it once chosen", async () => {
    const wrapper = await mount({
      steps: steps(["train", "dust2"]),
      pickingLineup: 1,
      isPicking: true,
      scouting: null,
    });

    await slice(wrapper, "mirage").trigger("pointermove");
    await new Promise((resolve) => setTimeout(resolve, 120));
    await nextTick();
    expect(slice(wrapper, "mirage").find(".vb-mark").exists()).toBe(true);
    expect(slice(wrapper, "mirage").find(".vb-mark").classes()).not.toContain(
      "is-armed",
    );

    await slice(wrapper, "mirage").trigger("click");
    expect(slice(wrapper, "mirage").find(".vb-mark").classes()).toContain(
      "is-armed",
    );
  });

  it("opens the map under the pointer when it is not your turn", async () => {
    const wrapper = await mount({
      steps: steps(["train", "dust2"]),
      pickingLineup: 2,
      isPicking: false,
    });

    await slice(wrapper, "mirage").trigger("pointermove");
    await new Promise((resolve) => setTimeout(resolve, 120));
    await nextTick();

    expect(slice(wrapper, "mirage").classes()).toContain("is-wide");
    expect(slice(wrapper, "mirage").findAll(".vb-rec")).toHaveLength(2);
    await slice(wrapper, "mirage").trigger("click");
    expect(wrapper.emitted("confirm")).toBeUndefined();
  });

  it("opens your own move for a moment when it lands", async () => {
    const wrapper = await mount({
      steps: steps(["train"]),
      pickingLineup: 2,
      isPicking: true,
      scouting: null,
    });

    await wrapper.setProps({ steps: steps(["train", "dust2"]) });

    expect(slice(wrapper, "dust2").classes()).toContain("is-wide");
    expect(
      slice(wrapper, "dust2").find(".vb-sub").attributes("data-tone"),
    ).toBe("Ban");
  });

  it("confirms by keys with a second Enter", async () => {
    const wrapper = await mount({
      steps: steps(["train", "dust2"]),
      pickingLineup: 1,
      isPicking: true,
      scouting: null,
    });

    await slice(wrapper, "nuke").trigger("keydown", { key: "Enter" });
    await slice(wrapper, "nuke").trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("confirm")).toEqual([[{ itemId: "nuke" }]]);
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

  it("raises the maps with the side each team starts on", async () => {
    const wrapper = await mount({
      steps: done,
      viewer: 1,
      start: { phase: "booting", maps },
    });

    expect(wrapper.find(".st-boot b").text()).toBe("Server booting");
    expect(wrapper.find(".vb-status").exists()).toBe(false);
    expect(wrapper.find(".st-area").classes()).toContain("is-starting");
    // The start's key takes over the scouting key's line.
    expect(wrapper.findAll(".vb-scoutkey")).toHaveLength(1);
    expect(wrapper.find(".vb-scoutkey").text()).toContain("Starting sides");
    expect(wrapper.find(".vb-scoutkey").text()).toContain("knife round");

    const panels = wrapper.findAll(".st-panel");
    expect(panels).toHaveLength(3);
    // Each map's number big in its middle (and in its label on a phone).
    expect(panels[0].find(".st-num").text()).toBe("Map1");
    expect(panels[2].find(".st-num").text()).toBe("Decider3");
    expect(panels[0].find(".st-kick").text()).toContain("Map 1");
    expect(panels[0].find(".st-kick").text()).toContain("Buttah Boyz");
    // The picker's crest sits in the corner; the decider has none.
    expect(panels[0].find(".by-b").text()).toBe("BB");
    expect(panels[2].find(".by-b").exists()).toBe(false);

    // Each side as its logo; your plate sits a step brighter.
    const plates = panels[0].findAll(".plate");
    expect(plates[0].find(".side").attributes("alt")).toBe("T");
    expect(plates[0].classes()).toContain("is-you");
    expect(plates[1].find(".side").attributes("alt")).toBe("CT");
    expect(plates[1].classes()).not.toContain("is-you");

    expect(panels[2].find(".plate.is-knife").text()).toContain("Knife round");
  });

  it("adds no key line of its own when scouting is off", async () => {
    const wrapper = await mount({
      steps: done,
      viewer: 1,
      scouting: null,
      start: { phase: "booting", maps },
    });

    expect(wrapper.find(".vb-scoutkey").exists()).toBe(false);
  });

  it("says nothing about a turn while the moves of a finished veto load", async () => {
    const wrapper = await mount({
      steps: steps([]),
      viewer: 1,
      scouting: null,
      start: { phase: "booting", maps },
    });

    expect(wrapper.find(".vb-status").exists()).toBe(false);
    expect(wrapper.find(".vr").classes()).toContain("vb-rail-hold");

    await wrapper.setProps({ steps: done });
    expect(wrapper.find(".vr").classes()).not.toContain("vb-rail-hold");
  });

  it("folds the maps away as soon as the server is ready", async () => {
    const wrapper = await mount({
      steps: done,
      viewer: 1,
      scouting: null,
      start: { phase: "booting", maps },
      handOff: true,
    });

    await wrapper.setProps({ start: { phase: "ready", maps } });
    expect(wrapper.find(".st-boot").classes()).not.toContain("is-shown");

    await new Promise((done) => setTimeout(done, 1000));
    expect(wrapper.emitted("handoff")).toHaveLength(1);
  });

  it("shows the finished board's maps the way the start will", async () => {
    const finished = steps([
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
    // Night Owls (2) chose CT on Mirage; Buttah Boyz (1) chose T on Nuke.
    finished[3].record = { itemId: "mirage", lineup: 2, side: "CT" };
    finished[5].record = { itemId: "nuke", lineup: 1, side: "TERRORIST" };
    const wrapper = await mount({
      steps: finished,
      viewer: 1,
      knifeRound: true,
    });

    const mirage = slice(wrapper, "mirage").findAll(".plate");
    expect(mirage[0].find(".side").attributes("alt")).toBe("T");
    expect(mirage[0].classes()).toContain("is-you");
    expect(mirage[1].find(".side").attributes("alt")).toBe("CT");
    expect(slice(wrapper, "ancient").find(".plate.is-knife").exists()).toBe(
      true,
    );
    // The decider says so once, in its badge.
    expect(slice(wrapper, "ancient").find(".vb-sub").exists()).toBe(false);
    // Each map to be played keeps its edge.
    expect(slice(wrapper, "mirage").find(".vb-edge").text()).toBe("+25");
  });

  it("keeps the edge on a map once it is picked", async () => {
    const wrapper = await mount({
      steps: steps(["train", "dust2", "mirage"]),
      viewer: 1,
    });

    expect(slice(wrapper, "mirage").find(".vb-edge").text()).toBe("+25");
    expect(slice(wrapper, "mirage").find(".vb-habit").exists()).toBe(false);
  });

  it("does not call the only map of a best of one first", async () => {
    const wrapper = await mount({
      steps: done,
      viewer: 2,
      scouting: null,
      bestOf: 1,
      start: { phase: "ready", maps: [maps[0]] },
    });

    expect(wrapper.find(".st-panel .st-kick").text()).toContain("The map");
    expect(wrapper.find(".st-num").exists()).toBe(false);
  });
});
