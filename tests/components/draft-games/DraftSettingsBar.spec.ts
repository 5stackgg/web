import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DraftSettingsBar from "~/components/draft-games/DraftSettingsBar.vue";
import { setApiClockBehindBy } from "../../helpers/serverClock";

describe("DraftSettingsBar", () => {
  afterEach(() => {
    setApiClockBehindBy(0);
  });

  it("counts the room's expiry on the api's clock when the device clock runs ahead", async () => {
    setApiClockBehindBy(120_000);

    const wrapper = await mountSuspended(DraftSettingsBar, {
      props: {
        room: {
          id: "room-1",
          status: "Open",
          match_id: null,
          capacity: 10,
          players: [],
          expires_at: new Date(Date.now() - 120_000 + 300_500).toISOString(),
        },
      },
    });

    expect(wrapper.find(".gauge--time .gauge-value").text()).toBe("5:00");
    wrapper.unmount();
  });
});
