import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchHeader from "~/components/match/MatchHeader.vue";

let unmount: (() => void) | undefined;

function waitingMatch(bestOf: number) {
  return {
    id: "match-1",
    status: "WaitingForCheckIn",
    source: "5stack",
    scheduled_at: null,
    ended_at: null,
    cancels_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    winning_lineup_id: null,
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    options: { best_of: bestOf, type: "Competitive" },
    e_region: { description: "Play Hard @ LAN" },
    e_match_status: { description: "Waiting for Check In" },
    lineup_1: { name: "Alpha", lineup_players: [] },
    lineup_2: { name: "Bravo", lineup_players: [] },
    tournament_brackets: [],
    match_maps: [],
  };
}

async function mountHeader(
  bestOf: number,
  overrides: Record<string, unknown> = {},
) {
  const wrapper = await mountSuspended(MatchHeader, {
    props: { match: { ...waitingMatch(bestOf), ...overrides } },
    global: {
      stubs: {
        MatchActions: { template: '<div class="match-actions" />' },
        MatchHeaderVeto: true,
        MatchSourceBadge: true,
        MatchLineupScoreDisplay: true,
      },
    },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe("MatchHeader series facts", () => {
  it("puts the facts and the cancel countdown in the status row, above a Bo5's maps", async () => {
    const wrapper = await mountHeader(5);
    const statusRow = wrapper.element.firstElementChild!;
    const bottom = wrapper.element.lastElementChild!;

    expect(statusRow.textContent).toContain(
      "Competitive · Best of 5 · Play Hard @ LAN",
    );
    const countdowns = Array.from(
      statusRow.querySelectorAll(".inline-grid"),
    ).filter((el) => el.textContent?.includes("Auto Canceling"));
    expect(countdowns).toHaveLength(2);
    expect(countdowns[0].classList.contains("md:hidden")).toBe(true);
    expect(countdowns[1].classList.contains("max-md:hidden")).toBe(true);
    expect(bottom.textContent).toContain("Map 5");
    expect(bottom.textContent).not.toContain("Best of 5");
    expect(bottom.textContent).not.toContain("Auto Canceling");
  });

  it("counts down to a tournament match's deadline instead of promising a cancel", async () => {
    const wrapper = await mountHeader(1, {
      tournament_brackets: [{ stage: { tournament: { id: "t-1" } } }],
    });

    expect(wrapper.text()).toContain("Deadline in");
    expect(wrapper.text()).not.toContain("Auto Canceling");
  });

  it("leaves no maps row under a Bo1", async () => {
    const wrapper = await mountHeader(1);
    const bottom = wrapper.element.lastElementChild!;

    expect(bottom.textContent?.trim()).toBe("");
    expect(bottom.children).toHaveLength(1);
  });
});
