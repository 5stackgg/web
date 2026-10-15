import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerMatchRow from "~/components/player/PlayerMatchRow.vue";

const WON = "text-[hsl(142_71%_60%)]";

function match(status: string) {
  return {
    id: "match-1",
    status,
    e_match_status: { description: status },
    source: "5stack",
    created_at: "2026-01-01T00:00:00Z",
    started_at: "2026-01-01T00:00:00Z",
    ended_at: "2026-01-01T00:40:00Z",
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    winning_lineup_id: "l1",
    lineup_1: { id: "l1", name: "Alpha", lineup_players: [{ steam_id: "1" }] },
    lineup_2: { id: "l2", name: "Bravo", lineup_players: [{ steam_id: "2" }] },
    options: { best_of: 1, type: "Competitive" },
    match_maps: [
      {
        id: "mm-1",
        winning_lineup_id: "l1",
        lineup_1_score: 13,
        lineup_2_score: 7,
        map: { name: "de_mirage", label: "Mirage", patch: null },
      },
    ],
    elo_changes: [],
    tournament_brackets: [],
  };
}

describe("PlayerMatchRow forfeits", () => {
  it.each([true, false])(
    "shows a forfeit's score as a win and labels it (compact: %s)",
    async (compact) => {
      const wrapper = await mountSuspended(PlayerMatchRow, {
        props: { match: match("Forfeit"), player: { steam_id: "1" }, compact },
      });

      const won = wrapper
        .findAll("span")
        .filter((span) => span.classes().includes(WON));
      expect(won.map((span) => span.text())).toEqual(["13"]);
      expect(wrapper.text()).toContain("Forfeit");
    },
  );

  it("labels a surrender", async () => {
    const wrapper = await mountSuspended(PlayerMatchRow, {
      props: { match: match("Surrendered"), player: { steam_id: "1" } },
    });

    expect(wrapper.text()).toContain("Surrendered");
    expect(wrapper.text()).toContain("13");
  });
});
