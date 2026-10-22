import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DraftTeamPanel from "~/components/draft-games/DraftTeamPanel.vue";

const member = (steamId: string, pickOrder: number) => ({
  steam_id: steamId,
  status: "Accepted",
  lineup: 1,
  pick_order: pickOrder,
  is_captain: pickOrder === 0,
  player: { steam_id: steamId, name: steamId },
});

const slotFor = (wrapper: any, label: string) =>
  wrapper.findAll(".empty-slot").find((slot: any) => slot.text() === label);

describe("DraftTeamPanel during a pick", () => {
  it("folds away the slot the pick fills and leaves the later ones in place", async () => {
    const wrapper = await mountSuspended(DraftTeamPanel, {
      props: {
        title: "Team 1",
        accent: "amber",
        perTeam: 3,
        players: [member("captain", 0)],
        upcomingPicks: [5, 8],
        clockPick: 5,
      },
    });
    const later = slotFor(wrapper, "Pick 8");
    expect(slotFor(wrapper, "On The Clock")).toBeTruthy();

    await wrapper.setProps({
      players: [member("captain", 0), member("picked", 1)],
      upcomingPicks: [8],
      clockPick: null,
    });

    // The same node, not the clock slot relabelled: it never moves or swaps.
    expect(slotFor(wrapper, "Pick 8")?.element).toBe(later.element);
    wrapper.unmount();
  });
});
