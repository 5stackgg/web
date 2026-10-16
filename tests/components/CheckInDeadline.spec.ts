import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import CheckInDeadline from "~/components/match/CheckInDeadline.vue";
import { setApiClockBehindBy } from "../helpers/serverClock";

describe("CheckInDeadline", () => {
  afterEach(() => {
    setApiClockBehindBy(0);
  });

  it("counts the check-in on the api's clock when the device clock runs ahead", async () => {
    setApiClockBehindBy(120_000);

    const wrapper = await mountSuspended(CheckInDeadline, {
      props: {
        cancelsAt: new Date(Date.now() - 120_000 + 300_500).toISOString(),
      },
    });

    expect(wrapper.find(".readout-digits").text()).toBe("5:00");
    wrapper.unmount();
  });
});
