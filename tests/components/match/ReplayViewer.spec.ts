import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ReplayViewer from "~/components/match/ReplayViewer.vue";
import ReplayStageUnavailable from "~/components/match/ReplayStageUnavailable.vue";

vi.mock("~/components/match/ReplayChrome.vue", () => ({
  default: defineComponent({ name: "ReplayChrome", render: () => null }),
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
    });

    expect(wrapper.exists()).toBe(true);
  });

  it.each(["unsupported", "missing-map"] as const)(
    "puts a message in the stage's place when it reports %s",
    async (reason) => {
      const wrapper = await mountSuspended(ReplayViewer, {
        props: {
          match: { id: "match-1", lineup_1: {}, lineup_2: {} },
          positions: [position(64), position(128)],
          mapName: "de_mirage",
        },
        global: {
          stubs: {
            ReplayStage: defineComponent({
              name: "ReplayStage",
              emits: ["unsupported", "missing-map"],
              mounted() {
                this.$emit(reason);
              },
              render: () => null,
            }),
          },
        },
      });
      await flushPromises();

      expect(
        wrapper.findComponent(ReplayStageUnavailable).props("reason"),
      ).toBe(reason);
      expect(wrapper.findComponent({ name: "ReplayStage" }).exists()).toBe(
        false,
      );
    },
  );
});
