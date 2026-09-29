import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ReplayViewer from "~/components/match/ReplayViewer.vue";

vi.mock("virtual:public?%2Fimg%2Fequipment%2Fc4.svg", () => ({
  default: "/img/equipment/c4.svg",
}));
vi.mock("virtual:public?%2Fimg%2Fequipment%2Fdefuser.svg", () => ({
  default: "/img/equipment/defuser.svg",
}));
vi.mock("~/components/match/ReplayChrome.vue", () => ({
  default: defineComponent({ name: "ReplayChrome", render: () => null }),
}));
vi.mock("~/components/match/Replay3DLite.vue", () => ({
  default: defineComponent({ name: "Replay3DLite", render: () => null }),
}));

function position(tick: number) {
  return {
    round: 1,
    tick,
    attacker_steam_id: "76561198000000001",
    attacker_team: "CT",
    alive: true,
    x: 100,
    y: 100,
    z: 0,
    yaw: 0,
    health: 100,
  };
}

function flash(phase: "thrown" | "detonated", tick: number) {
  return {
    round: 1,
    tick,
    grenade_id: 1,
    thrower_steam_id: "76561198000000001",
    thrower_team: "CT",
    type: "Flash" as const,
    phase,
    x: 200,
    y: 200,
    z: 0,
  };
}

describe("ReplayViewer", () => {
  it("mounts a replay whose round has a flash detonation", async () => {
    const wrapper = await mountSuspended(ReplayViewer, {
      props: {
        match: { id: "match-1", lineup_1: {}, lineup_2: {} },
        positions: [position(64), position(128)],
        grenades: [flash("thrown", 64), flash("detonated", 128)],
        mapName: "de_mirage",
      },
      global: {
        stubs: { RadarCallouts: true },
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
