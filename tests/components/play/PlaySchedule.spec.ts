import { describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlaySchedule from "~/components/play/PlaySchedule.vue";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

const checkInMatch = {
  id: "m1",
  status: "WaitingForCheckIn",
  can_check_in: true,
  options: { best_of: 1, type: "Competitive" },
  lineup_1: {
    id: "a",
    name: "wsadh1's Team",
    team: null,
    lineup_players: [{ checked_in: false, player: { steam_id: "me" } }],
  },
  lineup_2: {
    id: "b",
    name: "Retake Kings",
    team: null,
    lineup_players: [{ checked_in: true, player: { steam_id: "x" } }],
  },
  match_maps: [],
  tournament_brackets: [],
};

describe("PlaySchedule", () => {
  it("renders nothing when there's nothing on the schedule", async () => {
    useMatchLobbyStore().myMatches = [];
    const wrapper = await mountSuspended(PlaySchedule);
    expect(wrapper.find("section").exists()).toBe(false);
  });

  it("shows a check-in row with its one inline action", async () => {
    // A partial row: only the fields the schedule reads.
    useMatchLobbyStore().myMatches = [checkInMatch] as unknown as ReturnType<
      typeof useMatchLobbyStore
    >["myMatches"];
    const wrapper = await mountSuspended(PlaySchedule);
    await flushPromises();
    expect(wrapper.text()).toContain("wsadh1's Team");
    expect(wrapper.text()).toContain("Check-in 1/2");
    const buttons = wrapper.findAll(".schedule-row button, .schedule-row a");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toContain("Check in");
  });
});
