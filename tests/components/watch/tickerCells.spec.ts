import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatStartTime,
  resultDayLabel,
  sortLiveMatches,
  tickerCell,
  tickerFilterTabs,
} from "~/components/watch/watchTicker";

// Real English copy, so a renamed key fails here instead of rendering a path.
// Read raw: the i18n plugin compiles an imported locale into functions.
const en = JSON.parse(readFileSync("i18n/locales/en.json", "utf8"));

function t(key: string, values?: any): string {
  const raw = key.split(".").reduce((o: any, k) => o?.[k], en);
  if (typeof raw !== "string") throw new Error(`missing i18n key ${key}`);
  const count = typeof values === "number" ? values : values?.count;
  const forms = raw.split(" | ");
  const form = forms.length > 1 && count !== 1 ? forms[1] : forms[0];
  const named = typeof values === "number" ? { count: values } : (values ?? {});
  return form.replace(/\{(\w+)\}/g, (_, k) => String(named[k] ?? `{${k}}`));
}

const now = new Date(2026, 9, 2, 20, 40);
const ctx = { t, locale: "en-US", now };

const inferno = { name: "de_inferno", label: "Inferno" };
const lineup = (id: string, name: string, short: string, extra = {}) => ({
  id,
  name,
  team: { name, short_name: short, avatar_url: null },
  lineup_players: [],
  ...extra,
});

function match(overrides: Record<string, any> = {}) {
  return {
    id: "m1",
    status: "Live",
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    lineup_1: lineup("l1", "Buttah Boyz", "BB"),
    lineup_2: lineup("l2", "Saint's Team", "ST"),
    winning_lineup_id: null,
    options: { best_of: 1, mr: 12, type: "Competitive" },
    match_maps: [],
    tournament_brackets: [],
    event_links: [],
    streams: [],
    ...overrides,
  };
}

describe("ticker cell", () => {
  it("shows the live round and map score, with series pips on a Bo3", () => {
    const cell = tickerCell(
      match({
        options: { best_of: 3, mr: 12, type: "Competitive" },
        match_maps: [
          { id: "a", order: 1, status: "Finished", winning_lineup_id: "l1", lineup_1_score: 13, lineup_2_score: 9, map: { label: "Mirage" } },
          { id: "b", order: 2, status: "Live", is_current_map: true, winning_lineup_id: null, lineup_1_score: 10, lineup_2_score: 8, map: inferno },
        ],
      }),
      ctx,
    );

    expect(cell.kind).toBe("live");
    expect(cell.status).toEqual({
      dot: "live",
      text: "R19 · Inferno",
      detail: null,
    });
    expect(cell.teams.map((team) => team.score)).toEqual([10, 8]);
    expect(cell.teams[0].pips).toEqual({ won: 1, total: 2 });
    expect(cell.teams[1].emphasis).toBe("trail");
  });

  it("names the map state between rounds", () => {
    const at = (status: string) =>
      tickerCell(
        match({
          match_maps: [
            { id: "b", status, is_current_map: true, lineup_1_score: 12, lineup_2_score: 12, map: inferno },
          ],
        }),
        ctx,
      ).status.text;

    expect(at("Warmup")).toBe("Warmup · Inferno");
    expect(at("Paused")).toBe("Paused · Inferno");
    expect(at("Overtime")).toBe("OT · R25 · Inferno");
  });

  it("marks pre-match states as about to go live, without scores", () => {
    const veto = tickerCell(match({ status: "Veto" }), ctx);
    expect(veto.kind).toBe("pre");
    expect(veto.status).toEqual({
      dot: "soon",
      text: "About to go live",
      detail: "Map veto",
    });
    expect(veto.teams.map((team) => team.score)).toEqual([null, null]);
    expect(veto.checkIn).toBeNull();

    const server = tickerCell(match({ status: "WaitingForServer" }), ctx);
    expect(server.status.detail).toBe("Server setup");
  });

  it("counts check-in against the starters only, not the substitutes", () => {
    // Five starters plus two subs a side: max_players_per_lineup is 7.
    const players = (n: number, checked: number) =>
      Array.from({ length: n }, (_, i) => ({ checked_in: i < checked }));
    const checkIn = tickerCell(
      match({
        status: "WaitingForCheckIn",
        min_players_per_lineup: 5,
        max_players_per_lineup: 7,
        lineup_1: lineup("l1", "Buttah Boyz", "BB", { lineup_players: players(7, 6) }),
        lineup_2: lineup("l2", "Saint's Team", "ST", { lineup_players: players(7, 2) }),
      }),
      ctx,
    );

    expect(checkIn.status).toEqual({
      dot: "soon",
      text: "About to go live",
      detail: "Check-in",
    });
    expect(checkIn.teams.map((team) => team.checkIn)).toEqual([
      { checked: 5, total: 5 },
      { checked: 2, total: 5 },
    ]);
    expect(checkIn.checkIn).toEqual({ checked: 7, total: 10 });
    expect(t("pages.watch.ticker.check_in", checkIn.checkIn)).toBe(
      "Check-in 7/10",
    );
  });

  it("counts one captain a side when only captains check in", () => {
    const cell = tickerCell(
      match({
        status: "WaitingForCheckIn",
        min_players_per_lineup: 5,
        options: { best_of: 1, mr: 12, type: "Competitive", check_in_setting: "Captains" },
        lineup_1: lineup("l1", "Buttah Boyz", "BB", {
          lineup_players: [{ captain: true, checked_in: true }, { checked_in: true }],
        }),
        lineup_2: lineup("l2", "Saint's Team", "ST", {
          lineup_players: [{ captain: true, checked_in: false }, { checked_in: true }],
        }),
      }),
      ctx,
    );
    expect(cell.checkIn).toEqual({ checked: 1, total: 2 });

    const admin = tickerCell(
      match({
        status: "WaitingForCheckIn",
        options: { best_of: 1, mr: 12, type: "Competitive", check_in_setting: "Admin" },
      }),
      ctx,
    );
    expect(admin.checkIn).toBeNull();
    expect(admin.status.detail).toBe("Check-in");
  });

  it("shows when an upcoming match starts", () => {
    const tonight = new Date(2026, 9, 2, 21, 30).toISOString();
    const saturday = new Date(2026, 9, 3, 12, 0).toISOString();

    const cell = tickerCell(match({ status: "Scheduled", scheduled_at: tonight }), ctx);
    expect(cell.kind).toBe("upcoming");
    expect(cell.status.dot).toBeNull();
    expect(cell.status.text).toBe(formatStartTime(tonight, now, "en-US"));
    expect(cell.status.text).not.toMatch(/Sat/);
    expect(formatStartTime(saturday, now, "en-US")).toMatch(/^Sat/);
  });

  it("shows a final with the winner, map score on Bo1 and series on Bo3", () => {
    const bo1 = tickerCell(
      match({
        status: "Finished",
        winning_lineup_id: "l2",
        match_maps: [
          { id: "a", winning_lineup_id: "l2", lineup_1_score: 14, lineup_2_score: 16, map: inferno },
        ],
      }),
      ctx,
    );
    expect(bo1.status.text).toBe("Final · OT");
    expect(bo1.teams.map((team) => team.score)).toEqual([14, 16]);
    expect(bo1.teams.map((team) => team.emphasis)).toEqual([null, "win"]);

    const bo3 = tickerCell(
      match({
        status: "Finished",
        winning_lineup_id: "l1",
        options: { best_of: 3, mr: 12, type: "Competitive" },
        match_maps: [
          { id: "a", winning_lineup_id: "l1", lineup_1_score: 13, lineup_2_score: 9, map: inferno },
          { id: "b", winning_lineup_id: "l2", lineup_1_score: 11, lineup_2_score: 13, map: inferno },
          { id: "c", winning_lineup_id: "l1", lineup_1_score: 13, lineup_2_score: 6, map: inferno },
        ],
      }),
      ctx,
    );
    expect(bo3.status.text).toBe("Final · Bo3");
    expect(bo3.teams.map((team) => team.score)).toEqual([2, 1]);
    expect(bo3.teams[0].pips).toBeNull();
  });

  it("tags a match with its event and tournament", () => {
    const cell = tickerCell(
      match({
        event_links: [{ event: { id: "e", name: "Northside LAN" } }],
        tournament_brackets: [{ stage: { tournament: { id: "t", name: "Fall Cup" } } }],
      }),
      ctx,
    );
    expect(cell.tag).toBe("Northside LAN · Fall Cup");
    expect(tickerCell(match(), ctx).tag).toBe("Competitive");
  });

  it("marks the viewer's own matches", () => {
    expect(tickerCell(match({ is_in_lineup: true }), ctx).you).toBe(true);
    expect(tickerCell(match(), ctx).you).toBe(false);
  });
});

describe("ticker ordering and filters", () => {
  it("puts in-game matches before the pre-match states", () => {
    const sorted = sortLiveMatches([
      match({ id: "veto", status: "Veto" }),
      match({ id: "checkin", status: "WaitingForCheckIn" }),
      match({ id: "live", status: "Live" }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(["live", "veto", "checkin"]);
  });

  it("counts Live and Upcoming but never Results", () => {
    const tabs = tickerFilterTabs({ live: 3, upcoming: 4 }, t);
    expect(tabs.map((tab) => [tab.key, tab.count])).toEqual([
      ["all", null],
      ["live", "3"],
      ["upcoming", "4"],
      ["results", null],
    ]);
    expect(tickerFilterTabs({ live: 0, upcoming: 10 }, t)[2].count).toBe("10+");
  });

  it("labels result days", () => {
    expect(resultDayLabel(new Date(2026, 9, 2, 12).toISOString(), now, t, "en-US")).toBe("Today");
    expect(resultDayLabel(new Date(2026, 9, 1, 22).toISOString(), now, t, "en-US")).toBe("Yesterday");
    expect(resultDayLabel(new Date(2026, 8, 30, 22).toISOString(), now, t, "en-US")).toMatch(/Sep 30/);
  });
});
