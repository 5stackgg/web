import { describe, expect, it } from "vitest";
import { defineComponent } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityExecuteViewer3D from "~/components/utility/UtilityExecuteViewer3D.vue";
import UtilityLineupViewer3D from "~/components/utility/UtilityLineupViewer3D.vue";
import ReplayStageUnavailable from "~/components/match/ReplayStageUnavailable.vue";
import UtilityExecuteTransport from "~/components/utility/UtilityExecuteTransport.vue";
import { usePlaybackClock } from "~/composables/usePlaybackClock";

// A throw stage that cannot draw, for the reason given.
function failingStage(reason: "unsupported" | "missing-map") {
  return defineComponent({
    name: "UtilityThrowStage",
    emits: ["fallback", "framed"],
    mounted() {
      this.$emit("fallback", reason);
    },
    render: () => null,
  });
}

const lineup = {
  id: "lineup-1",
  name: "Window smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  side: "T",
  origin_x: 0,
  origin_y: 0,
  origin_z: 0,
  land_x: 100,
  land_y: 100,
  land_z: 0,
  flight_time_ms: 1500,
  trajectory_preview: null,
} as any;

describe("utility viewers without a stage", () => {
  it("puts a message in the lineup's scene and drops its play bar", async () => {
    const wrapper = await mountSuspended(UtilityLineupViewer3D, {
      props: { lineup },
      global: { stubs: { UtilityThrowStage: failingStage("missing-map") } },
    });
    await flushPromises();

    expect(wrapper.findComponent(ReplayStageUnavailable).props("reason")).toBe(
      "missing-map",
    );
    expect(wrapper.findComponent(UtilityExecuteTransport).exists()).toBe(false);
  });

  it("puts a message in the execute's scene and lets the run start", async () => {
    const wrapper = await mountSuspended(UtilityExecuteViewer3D, {
      props: {
        mapName: "de_mirage",
        beats: [{ key: "a", index: 0, lineup, seconds: 1, who: null }],
        run: usePlaybackClock({ length: () => 5 }),
      },
      global: { stubs: { UtilityThrowStage: failingStage("unsupported") } },
    });
    await flushPromises();

    expect(wrapper.findComponent(ReplayStageUnavailable).props("reason")).toBe(
      "unsupported",
    );
    expect(wrapper.emitted("framed")).toHaveLength(1);
  });
});
