import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventMatchRow from "~/components/events/EventMatchRow.vue";

function match(overrides: Record<string, any> = {}) {
  return {
    id: "m1",
    status: "Finished",
    started_at: "2025-11-09T07:01:00Z",
    created_at: "2025-11-09T07:00:00Z",
    winning_lineup_id: "l1",
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    options: { best_of: 1, mr: 12 },
    lineup_1: { id: "l1", name: "Buttah Boyz", lineup_players: [] },
    lineup_2: { id: "l2", name: "FermisGoldenRule's Team", lineup_players: [] },
    match_maps: [
      {
        id: "mm1",
        is_current_map: false,
        lineup_1_score: 13,
        lineup_2_score: 10,
        winning_lineup_id: "l1",
        map: { name: "de_mirage", label: "Mirage", poster: "/mirage.webp" },
      },
    ],
    ...overrides,
  };
}

describe("EventMatchRow", () => {
  it("links to the match and mutes the losing lineup", async () => {
    const wrapper = await mountSuspended(EventMatchRow, {
      props: { match: match() },
    });

    expect(wrapper.find('a[href="/matches/m1"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Mirage");
    const names = wrapper
      .findAll("span.truncate.text-sm")
      .map((name) => [name.text(), name.classes("text-muted-foreground")]);
    expect(names).toEqual([
      ["Buttah Boyz", false],
      ["FermisGoldenRule's Team", true],
    ]);
  });

  it("shows a live marker instead of the time while it is being played", async () => {
    const wrapper = await mountSuspended(EventMatchRow, {
      props: { match: match({ status: "Live", winning_lineup_id: null }) },
    });

    expect(wrapper.find(".animate-ping").exists()).toBe(true);
    expect(
      wrapper
        .findAll("span.truncate.text-sm")
        .every((name) => !name.classes("text-muted-foreground")),
    ).toBe(true);
  });
});
