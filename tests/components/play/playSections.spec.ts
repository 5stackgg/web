import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  defaultDraftFilters,
  draftAction,
  draftFilterCount,
  draftFormats,
  draftMetaParts,
  draftTitle,
  filterDraftRooms,
} from "~/components/play/draftRoomRow";
import {
  relativeWhen,
  scheduleMatchRow,
  scheduleTournamentRow,
  sortScheduleRows,
} from "~/components/play/scheduleRow";

// Real English copy, so a renamed key fails here instead of rendering a path.
// Read raw: the i18n plugin compiles an imported locale into functions.
const en = JSON.parse(readFileSync("i18n/locales/en.json", "utf8"));

function t(key: string, values?: any): string {
  const raw = key.split(".").reduce((o: any, k) => o?.[k], en);
  if (typeof raw !== "string") return key;
  const count = typeof values === "number" ? values : values?.count;
  const forms = raw.split(" | ");
  const form = forms.length > 1 && count !== 1 ? forms[1] : forms[0];
  const named = typeof values === "number" ? { count: values } : (values ?? {});
  return form.replace(/\{(\w+)\}/g, (_, k) => String(named[k] ?? `{${k}}`));
}

const player = (
  steamId: string,
  status: string,
  elo = 2000,
  name = steamId,
) => ({
  steam_id: steamId,
  status,
  elo_snapshot: elo,
  player: { steam_id: steamId, name },
});

const room = (overrides: Record<string, any> = {}) => ({
  id: "room-1",
  type: "Competitive",
  mode: "Captains",
  access: "Open",
  capacity: 10,
  regions: ["US East"],
  require_approval: false,
  created_at: "2026-10-02T20:00:00Z",
  host_steam_id: "host",
  host: { steam_id: "host", name: "k1tty" },
  players: [
    player("host", "Accepted", 2100, "k1tty"),
    player("a", "Accepted", 1900),
    player("b", "Accepted", 1850),
  ],
  ...overrides,
});

const solo = { meSteamId: "me", partySize: 1, isPartyLeader: false };
const partyOf3 = { meSteamId: "me", partySize: 3, isPartyLeader: true };

describe("draft room meta line", () => {
  it("is plain text parts: type, avg rank, region", () => {
    expect(draftMetaParts(room(), t, "en-US")).toEqual([
      "Captains draft",
      "Avg 1,950",
      "US East",
    ]);
  });

  it("names access only when the room isn't open", () => {
    expect(draftMetaParts(room({ access: "Invite" }), t, "en-US")).toContain(
      "Invite only",
    );
    expect(draftMetaParts(room({ access: "Open" }), t, "en-US")).not.toContain(
      "Open",
    );
  });

  it("spells a custom mode out as unranked", () => {
    const parts = draftMetaParts(
      room({ options: { game_mode: { name: "Rush" } } }),
      t,
      "en-US",
    );
    expect(parts.at(-1)).toBe("Rush mode, unranked");
  });

  it("titles a room by its match type, or by its two teams", () => {
    expect(draftTitle(room(), t)).toBe("Competitive");
    expect(
      draftTitle(
        room({ mode: "Teams", team_1: { name: "Northside Rats" } }),
        t,
      ),
    ).toBe("Northside Rats vs open team");
  });
});

describe("draft room action", () => {
  it("joins with the spots left as the reason", () => {
    const action = draftAction(room(), solo, t);
    expect(action).toMatchObject({ kind: "join", reason: "7 spots left" });
  });

  it("offers the whole party when it fits", () => {
    expect(draftAction(room(), partyOf3, t)).toMatchObject({
      kind: "join_party",
      label: "Join with party (3)",
    });
  });

  it("falls back to a solo join when the party doesn't fit", () => {
    const nearlyFull = room({
      capacity: 4,
      players: [player("host", "Accepted"), player("a", "Accepted")],
    });
    expect(draftAction(nearlyFull, partyOf3, t)).toMatchObject({
      kind: "join",
      reason: "No room for your party",
    });
  });

  it("asks the host when approval is required", () => {
    expect(
      draftAction(room({ require_approval: true }), solo, t),
    ).toMatchObject({ kind: "request", reason: "The host approves" });
  });

  it("only views a full room, naming the subs waiting", () => {
    const full = room({
      capacity: 2,
      players: [
        player("host", "Accepted"),
        player("a", "Accepted"),
        player("w1", "Waitlist"),
        player("w2", "Waitlist"),
      ],
    });
    expect(draftAction(full, solo, t)).toMatchObject({
      kind: "view",
      reason: "2 subs waiting",
    });
  });

  it("shows a member their room and a requester a disabled wait", () => {
    expect(
      draftAction(
        room({ players: [...room().players, player("me", "Accepted")] }),
        solo,
        t,
      ).kind,
    ).toBe("view");
    expect(
      draftAction(
        room({ players: [...room().players, player("me", "Requested")] }),
        solo,
        t,
      ),
    ).toMatchObject({ kind: "requested", disabled: true });
  });

  it("sends a guest to sign in", () => {
    expect(
      draftAction(
        room(),
        { meSteamId: null, partySize: 0, isPartyLeader: false },
        t,
      ).kind,
    ).toBe("sign_in");
  });
});

describe("draft room filters", () => {
  const rooms = [
    room({ id: "five", created_at: "2026-10-02T20:00:00Z" }),
    room({
      id: "two",
      capacity: 4,
      created_at: "2026-10-02T20:10:00Z",
      players: [
        player("host", "Accepted", 1500),
        player("a", "Accepted", 1500),
      ],
    }),
    room({
      id: "full",
      capacity: 2,
      players: [player("host", "Accepted"), player("x", "Accepted")],
    }),
  ];

  it("lists formats biggest first", () => {
    expect(draftFormats(rooms)).toEqual(["5v5", "2v2", "1v1"]);
  });

  it("filters by format and by space", () => {
    expect(
      filterDraftRooms(rooms, { ...defaultDraftFilters(), format: "2v2" }).map(
        (r) => r.id,
      ),
    ).toEqual(["two"]);
    expect(
      filterDraftRooms(rooms, { ...defaultDraftFilters(), hasSpace: true }).map(
        (r) => r.id,
      ),
    ).not.toContain("full");
  });

  it("sinks full rooms below the ones you can join", () => {
    expect(filterDraftRooms(rooms, defaultDraftFilters()).at(-1)?.id).toBe(
      "full",
    );
  });

  it("searches host and player names", () => {
    expect(
      filterDraftRooms(rooms, { ...defaultDraftFilters(), search: "K1TT" })
        .length,
    ).toBe(3);
  });

  it("counts popover filters, not format or search", () => {
    expect(
      draftFilterCount({
        ...defaultDraftFilters(),
        format: "5v5",
        search: "abc",
      }),
    ).toBe(0);
    expect(
      draftFilterCount({
        ...defaultDraftFilters(),
        hasSpace: true,
        sort: "newest",
        rankRange: [1000, 30000],
      }),
    ).toBe(3);
  });
});

describe("schedule rows", () => {
  const now = new Date(2026, 9, 2, 20, 40);
  const ctx = { t, locale: "en-US", now, meSteamId: "me" };
  const at = (hours: number, minutes: number) =>
    new Date(2026, 9, 2, hours, minutes).toISOString();
  const lineup = (id: string, name: string, players: any[] = []) => ({
    id,
    name,
    team: null,
    lineup_players: players,
  });
  const lp = (steamId: string, checkedIn: boolean) => ({
    checked_in: checkedIn,
    player: { steam_id: steamId },
  });

  it("says how soon a start is", () => {
    expect(relativeWhen(new Date(2026, 9, 2, 20, 55), now, t)).toBe(
      "in 15 min",
    );
    expect(relativeWhen(new Date(2026, 9, 3, 12, 0), now, t)).toBe("tomorrow");
    expect(relativeWhen(new Date(2026, 9, 2, 20, 0), now, t)).toBe("");
  });

  it("puts check-in first with the progress and the deadline", () => {
    const row = scheduleMatchRow(
      {
        id: "m1",
        status: "WaitingForCheckIn",
        scheduled_at: at(20, 55),
        cancels_at: at(20, 55),
        can_check_in: true,
        options: { best_of: 1, type: "Competitive" },
        lineup_1: lineup("a", "wsadh1's Team", [
          lp("me", false),
          lp("x", true),
        ]),
        lineup_2: lineup("b", "Retake Kings", [lp("y", true), lp("z", true)]),
        match_maps: [{ map: { label: "Nuke" } }],
        region: "US East",
        tournament_brackets: [],
      },
      ctx,
    );
    expect(row.action).toBe("check_in");
    expect(row.state).toEqual({
      text: "Check-in 3/4 · closes 8:55 PM",
      tone: "hot",
    });
    expect(row.sub).toBe("in 15 min");
    expect(row.meta).toBe("Competitive · Best of 1 · Nuke · US East");
  });

  it("drops the check-in action once I'm checked in", () => {
    const row = scheduleMatchRow(
      {
        id: "m1",
        status: "WaitingForCheckIn",
        can_check_in: true,
        lineup_1: lineup("a", "A", [lp("me", true)]),
        lineup_2: lineup("b", "B", [lp("y", false)]),
        match_maps: [],
      },
      ctx,
    );
    expect(row.action).toBe("open_match");
    expect(row.state).toEqual({ text: "Checked in · 1/2", tone: "ok" });
  });

  it("shows a live match's round and opens it when there's no connect link", () => {
    const row = scheduleMatchRow(
      {
        id: "m2",
        status: "Live",
        lineup_1: lineup("a", "A"),
        lineup_2: lineup("b", "B"),
        match_maps: [
          { is_current_map: true, lineup_1_score: 2, lineup_2_score: 1 },
        ],
      },
      ctx,
    );
    expect(row.state).toEqual({ text: "Live · Round 4", tone: "live" });
    expect(row.action).toBe("open_match");
    expect(row.time).toBe("Now");
  });

  it("gives tournaments their check-in opening and a details action", () => {
    const row = scheduleTournamentRow(
      {
        id: "t1",
        name: "Saturday Wingman",
        status: "RegistrationClosed",
        start: new Date(2026, 9, 3, 12, 0).toISOString(),
        check_in_required: true,
        check_in_opens_before_minutes: 30,
        options: { type: "Wingman" },
        teams_aggregate: { aggregate: { count: 12 } },
        stages: [],
      },
      ctx,
    );
    expect(row.action).toBe("details");
    expect(row.state.text).toBe("Check-in opens Sat 11:30 AM");
    expect(row.meta).toBe("2v2 · 12 teams");
  });

  it("sorts live first, then by start time", () => {
    const live = { key: "live", sortAt: Number.NEGATIVE_INFINITY } as any;
    const soon = { key: "soon", sortAt: 1 } as any;
    const later = { key: "later", sortAt: 2 } as any;
    const live2 = { key: "live2", sortAt: Number.NEGATIVE_INFINITY } as any;
    expect(
      sortScheduleRows([later, live, soon, live2]).map((r) => r.key),
    ).toEqual(["live", "live2", "soon", "later"]);
  });
});
