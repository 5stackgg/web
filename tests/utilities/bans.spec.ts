import { describe, expect, it } from "vitest";
import {
  banLength,
  banQueryArgs,
  banTimeline,
  defaultBanFilters,
  hasBanFilters,
  menuFilterCount,
  reasonCategory,
  sharedSide,
  sharedSummary,
  steamDateLabel,
  steamDayLabel,
  steamDaysAgo,
  type BanEntry,
  type SharedMatch,
} from "~/utilities/bans";
import { pinBrowserLocale } from "../helpers/browserLocale";

pinBrowserLocale("en-US");

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
    player: { steam_id: "76561198000000001", name: "nightowl" },
    sanction: null,
    ...overrides,
  };
}

function match(
  id: string,
  won: boolean | null,
  side: "teammate" | "opponent" = "opponent",
): SharedMatch {
  return {
    match_id: id,
    played_at: ago(2 * DAY),
    map: "de_inferno",
    viewer_score: won ? 13 : 9,
    other_score: won ? 9 : 13,
    won,
    side,
  };
}

describe("banQueryArgs", () => {
  it("leaves the kinds to the api's default when every kind is on", () => {
    const args = banQueryArgs(defaultBanFilters());

    expect(args).toEqual({
      _window_days: 30,
      _status: "any",
      _timing: "any",
      _played_with: "any",
      _lost_only: false,
      _search: null,
    });
    expect(args).not.toHaveProperty("_kinds");
  });

  it("sends the kinds as a Postgres array literal, narrowed by the source", () => {
    const steam = { ...defaultBanFilters(), source: "steam" as const };
    expect(banQueryArgs(steam)._kinds).toBe("{vac,game}");

    const fiveStack = { ...defaultBanFilters(), source: "5stack" as const };
    fiveStack.kinds = { ...fiveStack.kinds, auto: false };
    expect(banQueryArgs(fiveStack)._kinds).toBe("{staff}");

    const none = defaultBanFilters();
    none.kinds = { vac: false, game: false, staff: false, auto: false };
    expect(banQueryArgs(none)._kinds).toBe("{}");
  });

  it("treats Only matches I lost as played with me on either side", () => {
    const filters = { ...defaultBanFilters(), lostOnly: true };
    expect(banQueryArgs(filters)).toMatchObject({
      _played_with: "either",
      _lost_only: true,
    });

    const opponents = { ...filters, playedWith: "opponent" as const };
    expect(banQueryArgs(opponents)._played_with).toBe("opponent");
  });

  it("trims the search and drops an empty one", () => {
    expect(
      banQueryArgs({ ...defaultBanFilters(), search: "  owl " })._search,
    ).toBe("owl");
    expect(
      banQueryArgs({ ...defaultBanFilters(), search: "   " })._search,
    ).toBeNull();
  });
});

describe("filter counts", () => {
  it("counts what the Filters menu holds, not the bar", () => {
    const filters = defaultBanFilters();
    expect(menuFilterCount(filters)).toBe(0);
    expect(hasBanFilters(filters)).toBe(false);

    filters.kinds.game = false;
    filters.kinds.staff = false;
    filters.timing = "arrived_banned";
    expect(menuFilterCount(filters)).toBe(3);

    const bar = {
      ...defaultBanFilters(),
      windowDays: 90,
      playedWith: "teammate" as const,
    };
    expect(menuFilterCount(bar)).toBe(0);
    expect(hasBanFilters(bar)).toBe(true);
  });
});

describe("Steam dates", () => {
  it("counts whole UTC days back from today", () => {
    expect(steamDaysAgo("2026-10-21", NOW)).toBe(0);
    expect(steamDaysAgo("2026-10-20", NOW)).toBe(1);
    expect(steamDaysAgo("2026-10-12", NOW)).toBe(9);
  });

  it("reads today, yesterday and days ago for a week, then the date", () => {
    expect(steamDayLabel("2026-10-21", NOW)).toBe("Today");
    expect(steamDayLabel("2026-10-20", NOW)).toBe("Yesterday");
    expect(steamDayLabel("2026-10-18", NOW)).toBe("3 days ago");
    expect(steamDayLabel("2026-10-01", NOW)).toBe("Oct 1");
    expect(steamDayLabel("2022-12-09", NOW)).toBe("Dec 9, 2022");
  });

  it("keeps the Steam day whatever the viewer's time zone", () => {
    expect(steamDateLabel("2026-10-19", NOW)).toBe("Oct 19");
  });
});

describe("banLength", () => {
  const created = ago(4 * DAY);

  it("is permanent without an end date", () => {
    expect(banLength(created, null, NOW)).toEqual({ state: "permanent" });
  });

  it("gives the length and what is left", () => {
    const end = new Date(NOW.getTime() + 3 * DAY).toISOString();
    expect(banLength(created, end, NOW)).toEqual({
      state: "active",
      unit: "day",
      total: 7,
      leftUnit: "day",
      left: 3,
    });
  });

  it("switches to hours under a day", () => {
    const start = ago(HOUR);
    const end = new Date(NOW.getTime() + 2 * HOUR).toISOString();
    expect(banLength(start, end, NOW)).toEqual({
      state: "active",
      unit: "hour",
      total: 3,
      leftUnit: "hour",
      left: 2,
    });
  });

  it("is ended once the end date has passed", () => {
    const end = ago(6 * DAY);
    expect(banLength(ago(20 * DAY), end, NOW)).toEqual({
      state: "ended",
      endedAt: end,
    });
  });
});

describe("reasonCategory", () => {
  it("takes a short label before a colon", () => {
    expect(reasonCategory("Cheating: aimlock confirmed in the demo")).toBe(
      "Cheating",
    );
    expect(reasonCategory("Ban evasion: alt account")).toBe("Ban evasion");
  });

  it("leaves reasons without one alone", () => {
    expect(reasonCategory("Smurfing to boost a friend's rank.")).toBeNull();
    expect(reasonCategory(null)).toBeNull();
    expect(
      reasonCategory(
        "A very long sentence that happens to contain a colon: later",
      ),
    ).toBeNull();
  });
});

describe("played with me", () => {
  it("counts a match two banned players shared once, and a tie as no loss", () => {
    const summary = sharedSummary([
      { shared_matches: [match("m1", false), match("m2", true)] },
      { shared_matches: [match("m1", false), match("m3", null)] },
      { shared_matches: null },
    ]);
    expect(summary).toEqual({ matches: 3, lost: 1 });
  });

  it("names the side, or both", () => {
    expect(sharedSide([match("m1", false)])).toBe("opponent");
    expect(sharedSide([match("m1", true, "teammate")])).toBe("teammate");
    expect(
      sharedSide([match("m1", true, "teammate"), match("m2", false)]),
    ).toBe("both");
    expect(sharedSide([])).toBeNull();
  });
});

describe("banTimeline", () => {
  it("puts a Steam ban before the automatic ban it caused the same day", () => {
    const today = NOW.toISOString().slice(0, 10);
    const items = banTimeline(
      entry({
        steam_banned_on: today,
        vac_ban_count: 1,
        banned_here: true,
        sanction_id: "s1",
        sanction_kind: "auto",
        sanction: {
          id: "s1",
          reason: "Auto: Steam 1 VAC ban(s), last 0d ago",
          created_at: ago(30 * 60 * 1000),
          remove_sanction_date: null,
          sanctioned_by: null,
        },
      }),
      NOW,
    );

    expect(items.map((item) => item.type)).toEqual([
      "first_match",
      "last_match",
      "steam",
      "sanction",
    ]);
  });

  it("keeps a staff ban that came before Steam's first", () => {
    const items = banTimeline(
      entry({
        steam_banned_on: "2026-10-06",
        game_ban_count: 1,
        banned_here: true,
        sanction_id: "s1",
        sanction_kind: "staff",
        last_match_at: ago(18 * DAY),
        sanction: {
          id: "s1",
          reason: "Cheating: wallhack",
          created_at: ago(18 * DAY - HOUR),
          remove_sanction_date: null,
          sanctioned_by: { steam_id: "1", name: "mara" },
        },
      }),
      NOW,
    );

    expect(items.map((item) => item.type)).toEqual([
      "first_match",
      "last_match",
      "sanction",
      "steam",
    ]);
    expect(items.find((item) => item.type === "sanction")).toMatchObject({
      kind: "staff",
      by: "mara",
    });
  });

  it("shows an old Steam ban first and the only match once", () => {
    const items = banTimeline(
      entry({
        steam_banned_on: "2022-12-09",
        vac_ban_count: 2,
        game_ban_count: 1,
        arrived_banned: true,
        matches_played: 1,
        first_match_at: ago(2 * DAY),
        last_match_at: ago(2 * DAY),
      }),
      NOW,
    );

    expect(items).toMatchObject([
      { type: "steam", vac: 2, game: 1, arrived: true },
      { type: "first_match", only: true },
    ]);
  });

  it("adds the end of a ban that ran out, and matches since a game ban only when not banned here", () => {
    const ended = banTimeline(
      entry({
        sanction_id: "s1",
        sanction_kind: "staff",
        sanction: {
          id: "s1",
          reason: "Griefing: team-killed four times",
          created_at: ago(20 * DAY),
          remove_sanction_date: ago(6 * DAY),
          sanctioned_by: { steam_id: "1", name: "Dex" },
        },
      }),
      NOW,
    );
    expect(ended.map((item) => item.type)).toContain("sanction_end");

    const gap = banTimeline(
      entry({
        steam_banned_on: "2026-10-19",
        game_ban_count: 1,
        matches_since_steam_ban: 3,
        last_match_at: ago(7 * HOUR),
      }),
      NOW,
    );
    expect(gap.find((item) => item.type === "last_match")).toMatchObject({
      since: 3,
    });
  });
});
