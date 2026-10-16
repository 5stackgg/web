import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useQuickQueue } from "~/composables/useQuickQueue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { setApiClockBehindBy } from "../helpers/serverClock";

const Probe = defineComponent({
  setup() {
    const { clock } = useQuickQueue();
    return () => h("span", clock.value ?? "");
  },
});

describe("useQuickQueue search clock", () => {
  afterEach(() => {
    setApiClockBehindBy(0);
    useMatchmakingStore().joinedMatchmakingQueues = {
      details: undefined,
      confirmation: undefined,
    };
  });

  it("counts the search on the api's clock when the device clock runs ahead", async () => {
    setApiClockBehindBy(120_000);
    useMatchmakingStore().joinedMatchmakingQueues = {
      details: {
        type: "Competitive",
        regions: ["USE"],
        joinedAt: new Date(Date.now() - 120_000 - 65_000).toISOString(),
      },
      confirmation: undefined,
    } as any;

    const wrapper = await mountSuspended(Probe);

    expect(wrapper.text()).toMatch(/^1:0[56]$/);
    wrapper.unmount();
  });
});
