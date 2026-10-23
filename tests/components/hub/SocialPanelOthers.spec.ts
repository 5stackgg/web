import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import SocialPanel from "~/components/hub/SocialPanel.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe("the social panel's Others tab", () => {
  it("counts everyone online from the api's count, with no roster", async () => {
    useMatchmakingStore().setOnlineCount(17);

    const wrapper = await mountSuspended(SocialPanel, {
      global: { stubs: { PlayersList: true } },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    const others = wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text().includes("Others"));
    expect(others?.text()).toContain("17");
  });
});
