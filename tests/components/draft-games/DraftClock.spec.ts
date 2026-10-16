import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DraftClock from "~/components/draft-games/DraftClock.vue";
import { setApiClockBehindBy } from "../../helpers/serverClock";

describe("DraftClock", () => {
  afterEach(() => {
    setApiClockBehindBy(0);
  });

  it("counts and drains the ring on the api's clock", async () => {
    setApiClockBehindBy(120_000);

    const wrapper = await mountSuspended(DraftClock, {
      props: {
        deadline: new Date(Date.now() - 120_000 + 15_000).toISOString(),
        total: 30,
      },
    });
    await nextTick();

    const clock = wrapper.find(".draft-clock").element as HTMLElement;
    const share = Number(clock.style.getPropertyValue("--countdown"));
    expect(wrapper.text()).toMatch(/^(14|15)SEC$/);
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThanOrEqual(0.5);
    wrapper.unmount();
  });
});
