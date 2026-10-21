import { describe, expect, it, vi } from "vitest";
import { RouterLink } from "vue-router";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchTableRow from "~/components/MatchTableRow.vue";

function finishedMatch() {
  return {
    id: "match-1",
    status: "Finished",
    source: null,
    created_at: "2026-01-01T00:00:00Z",
    started_at: "2026-01-01T00:00:00Z",
    ended_at: "2026-01-01T00:40:00Z",
    lineup_1_id: "lineup-1",
    lineup_2_id: "lineup-2",
    winning_lineup_id: "lineup-1",
    lineup_1: { id: "lineup-1", name: "Alpha", team_id: "team-1" },
    lineup_2: { id: "lineup-2", name: "Pick-up Five", team_id: null },
    lineup_counts: { lineup_1_count: 5, lineup_2_count: 5 },
    max_players_per_lineup: 5,
    options: { best_of: 1, type: "Competitive" },
    match_maps: [],
    streams: [],
    tournament_brackets: [],
  };
}

describe.each([
  { layout: "compact", compact: true },
  { layout: "full", compact: false },
])("MatchTableRow team names ($layout)", ({ compact }) => {
  it("links a lineup with a team to /teams/<id>", async () => {
    const wrapper = await mountSuspended(MatchTableRow, {
      props: { match: finishedMatch(), compact },
    });

    const links = wrapper.findAll('a[href="/teams/team-1"]');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].text()).toBe("Alpha");
    expect(wrapper.find("nuxtlink").exists()).toBe(false);
  });

  it("does not link a lineup without a team", async () => {
    const wrapper = await mountSuspended(MatchTableRow, {
      props: { match: finishedMatch(), compact },
    });

    const pickUp = wrapper
      .findAll("span")
      .find((span) => span.text() === "Pick-up Five");
    expect(pickUp).toBeDefined();
    expect(pickUp!.element.closest("a")).toBeNull();
  });

  it("clicking the team name opens the team, not the match", async () => {
    const router = useRouter();
    const push = vi.spyOn(router, "push").mockResolvedValue(undefined);

    try {
      // mountSuspended swaps in a RouterLink whose navigate() is a no-op.
      const wrapper = await mountSuspended(MatchTableRow, {
        props: { match: finishedMatch(), compact },
        global: { components: { RouterLink } },
      });

      const teamName = wrapper
        .findAll("h3 > *")
        .find((element) => element.text() === "Alpha");
      await teamName!.trigger("click");

      expect(push).toHaveBeenCalledTimes(1);
      expect(router.resolve(push.mock.calls[0][0]).path).toBe("/teams/team-1");
    } finally {
      push.mockRestore();
    }
  });
});

describe("MatchTableRow duration", () => {
  it.each([
    ["en", "40m"],
    ["de", "40 Min."],
  ])("reads in %s", async (locale, expected) => {
    const i18n = (useNuxtApp() as any).$i18n;
    await i18n.setLocale(locale);

    try {
      const wrapper = await mountSuspended(MatchTableRow, {
        props: { match: finishedMatch(), compact: false },
      });

      expect(wrapper.text()).toContain(expected);
      wrapper.unmount();
    } finally {
      await i18n.setLocale("en");
    }
  });
});

describe("MatchTableRow stream gate", () => {
  it("sends a signed-out viewer to sign in instead of playing the stream", async () => {
    const settings = useApplicationSettingsStore();
    const setGlobalStream = vi.spyOn(settings, "setGlobalStream");

    const wrapper = await mountSuspended(MatchTableRow, {
      props: {
        match: {
          ...finishedMatch(),
          status: "Live",
          winning_lineup_id: null,
          streams: [
            {
              id: "stream-1",
              link: "https://twitch.tv/somechannel",
              is_game_streamer: false,
            },
          ],
        },
        compact: true,
        alwaysShow: true,
      },
    });

    const watch = wrapper.find('button[title="https://twitch.tv/somechannel"]');
    expect(watch.exists()).toBe(true);
    await watch.trigger("click");

    expect(setGlobalStream).not.toHaveBeenCalled();
    setGlobalStream.mockRestore();
  });
});

describe("MatchTableRow map names", () => {
  const ancient = {
    id: "mm-1",
    is_current_map: true,
    lineup_1_score: 7,
    lineup_2_score: 5,
    winning_lineup_id: null,
    map: { name: "de_ancient", label: null, patch: null, poster: null },
  };

  it.each([true, false])(
    "names an official map by its label, never its de_ name (compact: %s)",
    async (compact) => {
      const wrapper = await mountSuspended(MatchTableRow, {
        props: {
          match: {
            ...finishedMatch(),
            status: "Live",
            e_match_status: { description: "Live" },
            winning_lineup_id: null,
            match_maps: [ancient],
          },
          compact,
          alwaysShow: true,
        },
      });

      const titles = wrapper
        .findAll("[title]")
        .map((element) => element.attributes("title"));
      expect(titles.some((title) => title?.includes("Ancient"))).toBe(true);
      expect(titles.filter((title) => title?.includes("de_ancient"))).toEqual(
        [],
      );
      expect(wrapper.text()).not.toContain("de_ancient");
    },
  );
});

describe("MatchTableRow forfeits", () => {
  function forfeit(status = "Forfeit") {
    return {
      ...finishedMatch(),
      status,
      e_match_status: { description: status },
      options: { best_of: 3, type: "Competitive" },
      match_maps: [
        {
          id: "mm-1",
          winning_lineup_id: "lineup-1",
          lineup_1_score: 13,
          lineup_2_score: 4,
          map: {
            name: "de_mirage",
            label: "Mirage",
            patch: null,
            poster: null,
          },
        },
      ],
    };
  }

  it("lists a forfeit in a compact list, labelled, with the winner's score green", async () => {
    const wrapper = await mountSuspended(MatchTableRow, {
      props: { match: forfeit(), compact: true },
    });

    expect(wrapper.text()).toContain("Forfeit");
    const scores = wrapper.findAll("span.text-2xl");
    expect(scores.map((score) => score.text())).toEqual(["1", "0"]);
    expect(scores[0].classes()).toContain("text-green-500");
    expect(scores[1].classes()).toContain("text-red-500");
  });

  it("scores and colours a full row's surrender by its winner", async () => {
    const wrapper = await mountSuspended(MatchTableRow, {
      props: { match: forfeit("Surrendered") },
    });

    const [winner, , loser] = wrapper.findAll("div.text-2xl > span");
    expect(winner.text()).toBe("1");
    expect(winner.classes()).toContain("text-green-500");
    expect(loser.text()).toBe("0");
    expect(loser.classes()).toContain("text-red-500");
  });
});
