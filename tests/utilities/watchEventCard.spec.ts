import { describe, expect, it } from "vitest";
import {
  eventDayProgress,
  formatEventRange,
  formatStartTime,
  matchTypeLabel,
  tournamentChampion,
  tournamentRowState,
} from "~/utilities/watchEventCard";

const local = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m - 1, d, h).toISOString();

describe("eventDayProgress", () => {
  it("counts calendar days through a weekend event", () => {
    const starts = local(2026, 10, 2, 18);
    const ends = local(2026, 10, 4, 23);

    expect(eventDayProgress(starts, ends, new Date(2026, 9, 2, 20))).toEqual({
      day: 1,
      total: 3,
    });
    expect(eventDayProgress(starts, ends, new Date(2026, 9, 3, 9))).toEqual({
      day: 2,
      total: 3,
    });
    expect(eventDayProgress(starts, ends, new Date(2026, 9, 4, 22))).toEqual({
      day: 3,
      total: 3,
    });
  });

  it("caps at the last day and has no total for an open-ended event", () => {
    const starts = local(2026, 10, 2);
    expect(
      eventDayProgress(starts, local(2026, 10, 3), new Date(2026, 9, 9)),
    ).toEqual({ day: 2, total: 2 });
    expect(eventDayProgress(starts, null, new Date(2026, 9, 4))).toEqual({
      day: 3,
      total: null,
    });
  });

  it("has no day before the event starts", () => {
    expect(
      eventDayProgress(
        local(2026, 10, 5),
        local(2026, 10, 6),
        new Date(2026, 9, 2),
      ),
    ).toBeNull();
    expect(eventDayProgress(null, null)).toBeNull();
  });
});

describe("formatEventRange", () => {
  it("shows one date for a single-day event", () => {
    const value = formatEventRange(
      local(2026, 10, 2, 10),
      local(2026, 10, 2, 22),
    );
    expect(value).not.toContain("–");
  });

  it("shows a range across days", () => {
    expect(formatEventRange(local(2026, 10, 2), local(2026, 10, 4))).toMatch(
      /2.*4/,
    );
  });
});

describe("formatStartTime", () => {
  const now = new Date(2026, 9, 2, 20, 40);

  it("drops the day today and the time on short labels", () => {
    const tonight = new Date(2026, 9, 2, 22, 45).toISOString();
    const saturday = new Date(2026, 9, 3, 19, 0).toISOString();

    expect(formatStartTime(tonight, now)).not.toMatch(/Fri/);
    expect(formatStartTime(saturday, now)).toMatch(/Sat/);
    expect(formatStartTime(saturday, now, true)).toBe(
      new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
        new Date(saturday),
      ),
    );
  });

  it("shows a date beyond the coming week", () => {
    const later = new Date(2026, 9, 31, 19, 0).toISOString();
    expect(formatStartTime(later, now)).toMatch(/31/);
    expect(formatStartTime(null, now)).toBeNull();
  });
});

describe("matchTypeLabel", () => {
  it("maps match types to lineup sizes", () => {
    expect(matchTypeLabel("Competitive")).toBe("5v5");
    expect(matchTypeLabel("Wingman")).toBe("2v2");
    expect(matchTypeLabel("Duel")).toBe("1v1");
    expect(matchTypeLabel("Premier")).toBe("5v5");
    expect(matchTypeLabel(null)).toBe("5v5");
  });
});

describe("tournamentRowState", () => {
  it("groups statuses into live, finished and upcoming", () => {
    expect(tournamentRowState("Live")).toBe("live");
    expect(tournamentRowState("Paused")).toBe("live");
    expect(tournamentRowState("Finished")).toBe("finished");
    expect(tournamentRowState("CancelledMinTeams")).toBe("finished");
    expect(tournamentRowState("RegistrationOpen")).toBe("upcoming");
    expect(tournamentRowState("Setup")).toBe("upcoming");
  });
});

describe("tournamentChampion", () => {
  it("prefers the awarded winner", () => {
    expect(
      tournamentChampion({
        awards: [
          { placement: 2, tournament_team: { name: "Second" } },
          {
            placement: 1,
            tournament_team: { name: "Lineup", team: { name: "Retake Kings" } },
          },
        ],
        stages: [],
      }),
    ).toBe("Retake Kings");
  });

  it("falls back to the final stage's standings", () => {
    expect(
      tournamentChampion({
        awards: [],
        stages: [
          { order: 1, results: [{ rank: 1, team: { name: "Group winner" } }] },
          {
            order: 2,
            results: [
              { rank: 2, team: { name: "Runner up" } },
              { rank: 1, team: { name: "flickr" } },
            ],
          },
        ],
      }),
    ).toBe("flickr");
  });

  it("has no champion before results exist", () => {
    expect(
      tournamentChampion({ awards: [], stages: [{ order: 1 }] }),
    ).toBeNull();
  });
});
