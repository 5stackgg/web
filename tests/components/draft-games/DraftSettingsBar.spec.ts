import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DraftSettingsBar from "~/components/draft-games/DraftSettingsBar.vue";
import { draftRoomOptions } from "~/components/draft-games/draftRoomHeader";
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

    expect(wrapper.find(".draft-summary-closes").text()).toBe("5:00");
    wrapper.unmount();
  });

  it("reads a quick-hosted room without match options as the api's defaults", async () => {
    const wrapper = await mountSuspended(DraftSettingsBar, {
      props: {
        room: {
          id: "room-1",
          status: "Open",
          match_id: null,
          type: "Competitive",
          mode: "Captains",
          regions: ["US-East"],
          capacity: 10,
          players: [],
          options: null,
        },
      },
    });

    expect(wrapper.text()).toContain("Captains draft");
    expect(wrapper.text()).toContain(
      "Competitive · MR12 · Best of 1 · US-East",
    );
    expect(draftRoomOptions({ type: "Wingman", options: null })).toMatchObject({
      mr: 8,
      best_of: 1,
      overtime: true,
      knife_round: true,
      map_veto: true,
      coaches: false,
    });
    wrapper.unmount();
  });
});
