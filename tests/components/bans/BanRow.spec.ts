import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import BanRow from "~/components/bans/BanRow.vue";
import BanPlayedWithMenu from "~/components/bans/BanPlayedWithMenu.vue";
import { defaultBanFilters, type BanEntry } from "~/utilities/bans";

// Wed Oct 21 2026, 19:40 UTC.
const NOW = new Date(Date.UTC(2026, 9, 21, 19, 40));
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

function entry(overrides: Partial<BanEntry> = {}): BanEntry {
  return {
    steam_id: "76561198000000001",
    banned_at: ago(3 * HOUR),
    banned_at_source: "5stack",
    steam_banned_on: null,
    vac_ban_count: 0,
    game_ban_count: 0,
    sanction_id: null,
    sanction_kind: null,
    banned_here: false,
    first_match_at: ago(200 * DAY),
    last_match_at: ago(DAY),
    last_match_map: "de_mirage",
    matches_played: 40,
    matches_since_steam_ban: null,
    arrived_banned: false,
    shared_matches: null,
    player: null,
    sanction: null,
    ...overrides,
  };
}

const mount = (row: BanEntry, props: Record<string, unknown> = {}) =>
  mountSuspended(BanRow, {
    props: {
      entry: row,
      filters: defaultBanFilters(),
      now: NOW,
      signedIn: true,
      moderator: false,
      ...props,
    },
  });

describe("BanRow", () => {
  it("shows a game-banned player who can still play here", async () => {
    const wrapper = await mount(
      entry({
        banned_at: "2026-10-19T00:00:00Z",
        banned_at_source: "steam",
        steam_banned_on: "2026-10-19",
        game_ban_count: 1,
        matches_since_steam_ban: 3,
      }),
    );

    expect(wrapper.text()).toContain("Game ban");
    expect(wrapper.text()).toContain("2 days ago");
    expect(wrapper.text()).toContain("Not banned here");
    expect(wrapper.text()).toContain("3 matches since");
  });

  it("dims a Steam ban from before the window and dates it", async () => {
    const wrapper = await mount(
      entry({
        steam_banned_on: "2022-12-09",
        vac_ban_count: 2,
        arrived_banned: true,
        banned_here: true,
        sanction_id: "s1",
        sanction_kind: "auto",
        sanction: {
          id: "s1",
          reason: "Auto: Steam 2 VAC ban(s), last 1412d ago",
          created_at: ago(DAY + HOUR),
          remove_sanction_date: null,
          sanctioned_by: null,
        },
      }),
    );

    const vac = wrapper.find('span[title="Steam VAC ban"]');
    expect(vac.text()).toBe("VAC ×2 2022");
    expect(vac.classes()).toContain("text-muted-foreground/70");
    expect(wrapper.text()).toContain("Auto ban");
    expect(wrapper.text()).toContain("Permanent");
  });

  it("dates a VAC ban and a game ban each on its own", async () => {
    const wrapper = await mount(
      entry({
        banned_at: "2026-10-19T00:00:00Z",
        banned_at_source: "steam",
        steam_banned_on: "2026-10-19",
        vac_banned_on: "2016-09-01",
        game_banned_on: "2026-10-19",
        vac_ban_count: 1,
        game_ban_count: 1,
      }),
    );

    const vac = wrapper.find('span[title="Steam VAC ban"]');
    expect(vac.text()).toBe("VAC 2016");
    expect(vac.classes()).toContain("text-muted-foreground/70");
    const game = wrapper.find('span[title="Steam game ban (CS2 Overwatch)"]');
    expect(game.text()).toBe("Game ban");
    expect(game.classes()).not.toContain("text-muted-foreground/70");
  });

  it.each([
    {
      title: "each kind by its own year",
      row: {
        steam_banned_on: "2020-05-01",
        vac_banned_on: "2016-09-01",
        game_banned_on: "2020-05-01",
        vac_ban_count: 1,
        game_ban_count: 1,
      },
      vac: "VAC 2016",
      game: "Game ban 2020",
    },
    {
      title: "a shared year once, on an api without a day per kind",
      row: {
        steam_banned_on: "2022-12-09",
        vac_ban_count: 1,
        game_ban_count: 1,
      },
      vac: "VAC 2022",
      game: "Game ban",
    },
    {
      title: "a game ban on its own",
      row: { steam_banned_on: "2022-12-09", game_ban_count: 1 },
      vac: null,
      game: "Game ban 2022",
    },
  ])("dates old Steam tags: $title", async ({ row, vac, game }) => {
    const wrapper = await mount(entry(row));

    const vacTag = wrapper.find('span[title="Steam VAC ban"]');
    expect(vacTag.exists() ? vacTag.text() : null).toBe(vac);
    expect(
      wrapper.find('span[title="Steam game ban (CS2 Overwatch)"]').text(),
    ).toBe(game);
  });

  it("lists a Steam ban under the day of the ban the filters matched", async () => {
    const wrapper = await mount(
      entry({
        banned_at: "2026-10-11T00:00:00Z",
        banned_at_source: "steam",
        steam_banned_on: "2026-10-19",
        vac_banned_on: "2026-10-11",
        game_banned_on: "2026-10-19",
        vac_ban_count: 1,
        game_ban_count: 1,
      }),
      {
        filters: {
          ...defaultBanFilters(),
          kinds: { vac: true, game: false, staff: true, auto: true },
        },
      },
    );

    expect(wrapper.text()).toContain("Oct 11");
    expect(wrapper.text()).not.toContain("2 days ago");
  });

  it("names who issued a staff ban only to moderators", async () => {
    const row = entry({
      banned_here: true,
      sanction_id: "s1",
      sanction_kind: "staff",
      sanction: {
        id: "s1",
        reason: "Cheating: aimlock confirmed in the demo review",
        created_at: ago(13 * HOUR),
        remove_sanction_date: new Date(NOW.getTime() + 3 * DAY).toISOString(),
        sanctioned_by: { steam_id: "1", name: "Luke" },
      },
    });

    const player = await mount(row);
    expect(player.text()).toContain("Cheating");
    expect(player.text()).not.toContain("by Luke");
    expect(player.text()).toContain("3 days left");

    const moderator = await mount(row, { moderator: true });
    expect(moderator.text()).toContain("by Luke");
  });

  it("links the matches you played with them", async () => {
    const wrapper = await mount(
      entry({
        shared_matches: [
          {
            match_id: "m1",
            played_at: ago(DAY),
            map: "de_mirage",
            viewer_score: 9,
            other_score: 13,
            won: false,
            side: "opponent",
          },
          {
            match_id: "m2",
            played_at: ago(6 * DAY),
            map: "de_inferno",
            viewer_score: 12,
            other_score: 12,
            won: null,
            side: "opponent",
          },
        ],
      }),
    );

    const links = wrapper.findAll('a[href^="/matches/"]');
    expect(links.map((link) => link.attributes("href"))).toEqual([
      "/matches/m1",
      "/matches/m2",
    ]);
    expect(links[0].find(".text-red-400").text()).toBe("9–13");
    expect(links[1].find(".text-foreground").text()).toBe("12–12");
    expect(wrapper.text()).toContain("Opponent");
  });

  it("has no With you column for guests", async () => {
    const wrapper = await mount(entry(), { signedIn: false });
    expect(wrapper.text()).not.toContain("—");
  });
});

describe("BanPlayedWithMenu", () => {
  it("labels the trigger by side and losses", async () => {
    const wrapper = await mountSuspended(BanPlayedWithMenu, {
      props: { playedWith: "any", lostOnly: false },
    });
    expect(wrapper.text()).toContain("Played with me");

    await wrapper.setProps({ playedWith: "opponent", lostOnly: true });
    expect(wrapper.text()).toContain("Against me, lost");
  });
});
