// @vitest-environment node
import { describe, expect, it } from "vitest";
import { e_match_status_enum } from "~/generated/zeus";
import {
  countTournamentMatches,
  matchBucket,
  orderTournamentMatches,
  tournamentMatchesFor,
} from "~/utilities/tournamentMatchFilter";

function match(
  id: string,
  status: string,
  times: {
    created_at?: string;
    scheduled_at?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
  } = {},
) {
  return {
    id,
    status,
    created_at: "2026-10-01T00:00:00Z",
    scheduled_at: null,
    started_at: null,
    ended_at: null,
    ...times,
  };
}

const ids = (matches: Array<{ id: string }>) => matches.map(({ id }) => id);

describe("matchBucket", () => {
  it("puts every match status in a bucket", () => {
    expect(
      Object.fromEntries(
        Object.values(e_match_status_enum).map((status) => [
          status,
          matchBucket(status),
        ]),
      ),
    ).toEqual({
      Live: "live",
      Veto: "live",
      WaitingForCheckIn: "live",
      WaitingForServer: "live",
      PickingPlayers: "live",
      Scheduled: "upcoming",
      Finished: "results",
      Forfeit: "results",
      Surrendered: "results",
      Tie: "results",
      Canceled: "other",
    });
  });

  it("leaves a status it does not know out of every filter but All", () => {
    expect(matchBucket("SomethingNew")).toBe("other");
    expect(matchBucket(null)).toBe("other");
  });
});

describe("orderTournamentMatches", () => {
  const finishedOct9 = match("finished-oct-9", "Finished", {
    started_at: "2026-10-09T18:00:00Z",
    ended_at: "2026-10-09T19:10:00Z",
  });
  const finishedOct10 = match("finished-oct-10", "Finished", {
    started_at: "2026-10-10T19:00:00Z",
    ended_at: "2026-10-10T20:05:00Z",
  });
  const scheduledOct12 = match("scheduled-oct-12", "Scheduled", {
    scheduled_at: "2026-10-12T20:00:00Z",
  });
  const scheduledOct11 = match("scheduled-oct-11", "Scheduled", {
    scheduled_at: "2026-10-11T18:00:00Z",
  });
  const live = match("live", "Live", { started_at: "2026-10-11T21:30:00Z" });
  const canceled = match("canceled", "Canceled", {
    scheduled_at: "2026-10-08T18:00:00Z",
  });

  it("leads with live, then upcoming soonest first, then results newest first, then cancelled", () => {
    expect(
      ids(
        orderTournamentMatches([
          finishedOct10,
          scheduledOct12,
          canceled,
          live,
          finishedOct9,
          scheduledOct11,
        ]),
      ),
    ).toEqual([
      "live",
      "scheduled-oct-11",
      "scheduled-oct-12",
      "finished-oct-10",
      "finished-oct-9",
      "canceled",
    ]);
  });

  it("puts a match that is being played ahead of one still in its pre-match steps", () => {
    const veto = match("veto", "Veto", {
      scheduled_at: "2026-10-11T20:00:00Z",
    });
    const checkIn = match("check-in", "WaitingForCheckIn");
    const playing = match("playing", "Live", {
      started_at: "2026-10-11T19:00:00Z",
    });

    expect(ids(orderTournamentMatches([checkIn, veto, playing]))[0]).toBe(
      "playing",
    );
  });

  it("lists an upcoming match with no time yet after the scheduled ones, oldest first", () => {
    const unscheduledNewer = match("unscheduled-newer", "Scheduled", {
      created_at: "2026-10-03T00:00:00Z",
    });
    const unscheduledOlder = match("unscheduled-older", "Scheduled", {
      created_at: "2026-10-02T00:00:00Z",
    });

    expect(
      ids(
        orderTournamentMatches([
          unscheduledNewer,
          scheduledOct12,
          unscheduledOlder,
        ]),
      ),
    ).toEqual(["scheduled-oct-12", "unscheduled-older", "unscheduled-newer"]);
  });

  it("orders a forfeit that never started by when it was due", () => {
    const forfeit = match("forfeit", "Forfeit", {
      scheduled_at: "2026-10-11T12:00:00Z",
    });

    expect(
      ids(orderTournamentMatches([finishedOct9, forfeit, finishedOct10])),
    ).toEqual(["forfeit", "finished-oct-10", "finished-oct-9"]);
  });

  it("does not reorder the list it was given", () => {
    const matches = [finishedOct9, live];

    orderTournamentMatches(matches);

    expect(ids(matches)).toEqual(["finished-oct-9", "live"]);
  });
});

describe("tournamentMatchesFor", () => {
  const matches = [
    match("finished", "Finished", { ended_at: "2026-10-10T20:00:00Z" }),
    match("scheduled", "Scheduled", { scheduled_at: "2026-10-12T20:00:00Z" }),
    match("live", "Live", { started_at: "2026-10-11T21:30:00Z" }),
    match("surrendered", "Surrendered", { ended_at: "2026-10-09T19:00:00Z" }),
    match("canceled", "Canceled"),
  ];

  it("keeps cancelled matches under All only", () => {
    expect(ids(tournamentMatchesFor(matches, "all"))).toEqual([
      "live",
      "scheduled",
      "finished",
      "surrendered",
      "canceled",
    ]);
    expect(ids(tournamentMatchesFor(matches, "live"))).toEqual(["live"]);
    expect(ids(tournamentMatchesFor(matches, "upcoming"))).toEqual([
      "scheduled",
    ]);
    expect(ids(tournamentMatchesFor(matches, "results"))).toEqual([
      "finished",
      "surrendered",
    ]);
  });

  it("counts each filter, with All counting the cancelled ones too", () => {
    expect(countTournamentMatches(matches)).toEqual({
      live: 1,
      upcoming: 1,
      results: 2,
      all: 5,
    });
    expect(countTournamentMatches([])).toEqual({
      live: 0,
      upcoming: 0,
      results: 0,
      all: 0,
    });
  });
});
