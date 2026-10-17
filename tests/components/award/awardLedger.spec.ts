import { describe, expect, it } from "vitest";
import {
  AWARD_RECENT_MS,
  awardFacetValues,
  awardOwner,
  awardStatusKeys,
  awardViewValidators,
  belongsTo,
  highlightParts,
  matchesKind,
  matchesSearch,
  ownerIsLive,
  sortAwards,
} from "~/components/award/awardLedger";

const NOW = Date.UTC(2026, 9, 16);
const DAY = 86_400_000;
const iso = (time: number) => new Date(time).toISOString();

const granted = (time: number | null, count = 1) => ({
  recipients_aggregate: {
    aggregate: { count, max: { created_at: time === null ? null : iso(time) } },
  },
});

describe("awardOwner", () => {
  it("reads a tournament's phase from its status", () => {
    const owner = (status: string) =>
      awardOwner(
        { tournament_id: "t", tournament: { name: "Cup", status } },
        NOW,
      );
    expect(owner("Live")?.phase).toBe("live");
    expect(owner("RegistrationOpen")?.phase).toBe("upcoming");
    expect(owner("Cancelled")?.phase).toBe("finished");
  });

  it("reads events and seasons from their dates", () => {
    const event = (starts: number, ends: number) =>
      awardOwner(
        {
          event_id: "e",
          event: { name: "LAN", starts_at: iso(starts), ends_at: iso(ends) },
        },
        NOW,
      )?.phase;
    expect(event(NOW + DAY, NOW + 2 * DAY)).toBe("upcoming");
    expect(event(NOW - DAY, NOW + DAY)).toBe("live");
    expect(event(NOW - 3 * DAY, NOW - DAY)).toBe("finished");
  });

  it("marks an owner that no longer loads as gone", () => {
    expect(
      awardOwner({ league_season_id: "l", league_season: null })?.phase,
    ).toBe("gone");
  });

  it("files built-ins apart from general awards", () => {
    expect(belongsTo({ system_key: "season_gold" })).toBe("builtin");
    expect(belongsTo({})).toBe("global");
    expect(belongsTo({ season_id: "s", season: { number: 5 } })).toBe("season");
  });
});

describe("awardStatusKeys", () => {
  it("knows never, recent and the owner's phase", () => {
    expect(awardStatusKeys(granted(null, 0), NOW)).toEqual(["never"]);
    expect(awardStatusKeys(granted(NOW - DAY), NOW)).toEqual(["recent"]);
    expect(awardStatusKeys(granted(NOW - AWARD_RECENT_MS - DAY), NOW)).toEqual(
      [],
    );
    expect(
      awardStatusKeys(
        {
          ...granted(null, 0),
          tournament_id: "t",
          tournament: { status: "Live" },
        },
        NOW,
      ),
    ).toEqual(["never", "open"]);
  });

  it("feeds the facet values", () => {
    expect(awardFacetValues({ tier: "nonsense" }, "tier")).toBe("special");
    expect(awardFacetValues({ system_key: "tournament_mvp" }, "owner")).toBe(
      "builtin",
    );
  });
});

describe("filters and sort", () => {
  const a = { name: "Ace", ...granted(NOW - 5 * DAY, 3) };
  const b = { name: "Bug", system_key: "x", ...granted(NOW - DAY, 1) };
  const c = { name: "Clutch", ...granted(null, 0) };

  it("splits custom from built-in", () => {
    expect([a, b, c].filter((x) => matchesKind(x, "builtin"))).toEqual([b]);
    expect([a, b, c].filter((x) => matchesKind(x, "custom"))).toEqual([a, c]);
  });

  it("searches name, description and owner", () => {
    expect(matchesSearch({ name: "Entry King" }, "king")).toBe(true);
    expect(matchesSearch({ name: "X" }, "frost", "Frostbite 2026")).toBe(true);
    expect(matchesSearch({ name: "X" }, "frost")).toBe(false);
  });

  it("sorts by last granted, holders and name", () => {
    expect(sortAwards([a, b, c], "last").map((x) => x.name)).toEqual([
      "Bug",
      "Ace",
      "Clutch",
    ]);
    expect(sortAwards([c, b, a], "holders").map((x) => x.name)).toEqual([
      "Ace",
      "Bug",
      "Clutch",
    ]);
    expect(sortAwards([c, a, b], "name").map((x) => x.name)).toEqual([
      "Ace",
      "Bug",
      "Clutch",
    ]);
  });

  it("flips a column against its natural direction", () => {
    expect(sortAwards([c, a, b], "name", "desc").map((x) => x.name)).toEqual([
      "Clutch",
      "Bug",
      "Ace",
    ]);
    expect(sortAwards([a, b, c], "holders", "asc").map((x) => x.name)).toEqual([
      "Clutch",
      "Bug",
      "Ace",
    ]);
  });

  it("marks every search hit", () => {
    expect(highlightParts("Cup of Cups", "cup")).toEqual([
      { text: "Cup", hit: true },
      { text: " of ", hit: false },
      { text: "Cup", hit: true },
      { text: "s", hit: false },
    ]);
  });
});

describe("ownerIsLive", () => {
  it("pings only for a tournament or event underway", () => {
    const owner = (kind: any, phase: any) => ({
      kind,
      phase,
      id: "x",
      name: null,
      number: null,
      start: null,
      end: null,
      to: null,
    });
    expect(ownerIsLive(owner("tournament", "live"))).toBe(true);
    expect(ownerIsLive(owner("event", "live"))).toBe(true);
    expect(ownerIsLive(owner("league", "live"))).toBe(false);
    expect(ownerIsLive(owner("season", "live"))).toBe(false);
    expect(ownerIsLive(owner("tournament", "upcoming"))).toBe(false);
    expect(ownerIsLive(null)).toBe(false);
  });
});

describe("awardViewValidators", () => {
  it("restores only known sorts, kinds and facet values", () => {
    expect(awardViewValidators.sort("holders")).toBe(true);
    expect(awardViewValidators.sort("toString")).toBe(false);
    expect(awardViewValidators.kind("builtin")).toBe(true);
    expect(awardViewValidators.kind("everything")).toBe(false);
    expect(awardViewValidators.dir("up")).toBe(false);
    expect(
      awardViewValidators.facets({
        owner: ["event"],
        tier: ["gold"],
        status: [],
      }),
    ).toBe(true);
    expect(
      awardViewValidators.facets({ owner: ["nope"], tier: [], status: [] }),
    ).toBe(false);
    expect(awardViewValidators.facets({ owner: [] })).toBe(false);
    expect(awardViewValidators.facets(["gold"])).toBe(false);
  });
});
