import { describe, expect, it } from "vitest";
import {
  bracketNegotiationStatus,
  bracketProposalWindow,
  canNegotiateBracket,
  canRespondToBracketProposal,
  isNegotiableBracket,
} from "~/utilities/bracketNegotiation";

const CAPTAIN_1 = "76561198000000001";
const CAPTAIN_2 = "76561198000000002";
const ADMIN = "76561198000000009";
const NOW = new Date("2026-10-02T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const negotiated = {
  scheduling_mode: "negotiated",
  league_season_division: null,
};

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    proposed_time: "2026-10-03T20:00:00.000Z",
    status: "Pending",
    message: null,
    proposed_by_steam_id: CAPTAIN_1,
    proposed_by: { steam_id: CAPTAIN_1, name: "kairo" },
    ...overrides,
  };
}

function bracket(overrides: Record<string, any> = {}) {
  return {
    id: "bracket-1",
    round: 2,
    bye: false,
    finished: false,
    scheduled_at: null,
    team_1: { id: "tt-1", name: "Iron Wolves", team_id: "team-1" },
    team_2: { id: "tt-2", name: "Night Owls", team_id: "team-2" },
    match: null,
    scheduling_proposals: [],
    ...overrides,
  };
}

const viewer = (overrides: Record<string, any> = {}) => ({
  isAdmin: false,
  mySteamId: null as string | null,
  managedTeamIds: [] as string[],
  ...overrides,
});

const captain1 = viewer({ mySteamId: CAPTAIN_1, managedTeamIds: ["team-1"] });
const captain2 = viewer({ mySteamId: CAPTAIN_2, managedTeamIds: ["team-2"] });
const admin = viewer({ isAdmin: true, mySteamId: ADMIN });
const spectator = viewer({ mySteamId: "76561198000000005" });

describe("isNegotiableBracket", () => {
  it("offers negotiation once both teams are set and no match exists", () => {
    expect(isNegotiableBracket(negotiated, bracket())).toBe(true);
  });

  it("keeps offering it while the match is Scheduled or waiting for check-in", () => {
    for (const status of ["Scheduled", "WaitingForCheckIn"]) {
      expect(
        isNegotiableBracket(
          negotiated,
          bracket({ match: { id: "m", status } }),
        ),
      ).toBe(true);
    }
  });

  it("stops once the match is under way or done", () => {
    for (const status of ["Veto", "Live", "Finished", "Canceled"]) {
      expect(
        isNegotiableBracket(
          negotiated,
          bracket({ match: { id: "m", status } }),
        ),
      ).toBe(false);
    }
  });

  it("only applies to negotiated tournaments", () => {
    expect(
      isNegotiableBracket({ scheduling_mode: "auto" }, bracket()),
    ).toBe(false);
    expect(isNegotiableBracket(undefined, bracket())).toBe(false);
  });

  it("leaves league division fixtures to the league schedule", () => {
    expect(
      isNegotiableBracket(
        { ...negotiated, league_season_division: { id: "division-1" } },
        bracket(),
      ),
    ).toBe(false);
  });

  it("skips byes, finished brackets and brackets missing a team", () => {
    expect(isNegotiableBracket(negotiated, bracket({ bye: true }))).toBe(
      false,
    );
    expect(isNegotiableBracket(negotiated, bracket({ finished: true }))).toBe(
      false,
    );
    expect(isNegotiableBracket(negotiated, bracket({ team_2: null }))).toBe(
      false,
    );
  });
});

describe("canNegotiateBracket", () => {
  it("lets a manager of either team or an administrator propose", () => {
    expect(canNegotiateBracket(bracket(), captain1)).toBe(true);
    expect(canNegotiateBracket(bracket(), captain2)).toBe(true);
    expect(canNegotiateBracket(bracket(), admin)).toBe(true);
  });

  it("does not let anyone else propose", () => {
    expect(canNegotiateBracket(bracket(), spectator)).toBe(false);
    expect(canNegotiateBracket(bracket(), viewer())).toBe(false);
  });
});

describe("canRespondToBracketProposal", () => {
  const withProposal = bracket({ scheduling_proposals: [proposal()] });

  it("lets the other team answer", () => {
    expect(
      canRespondToBracketProposal(withProposal, proposal(), captain2),
    ).toBe(true);
  });

  it("does not let the proposer answer their own offer", () => {
    expect(
      canRespondToBracketProposal(withProposal, proposal(), captain1),
    ).toBe(false);
  });

  it("lets an administrator answer anything pending", () => {
    expect(canRespondToBracketProposal(withProposal, proposal(), admin)).toBe(
      true,
    );
    expect(
      canRespondToBracketProposal(
        withProposal,
        proposal({ proposed_by_steam_id: ADMIN }),
        admin,
      ),
    ).toBe(true);
  });

  it("ignores spectators and settled proposals", () => {
    expect(
      canRespondToBracketProposal(withProposal, proposal(), spectator),
    ).toBe(false);
    expect(
      canRespondToBracketProposal(
        withProposal,
        proposal({ status: "Declined" }),
        captain2,
      ),
    ).toBe(false);
  });
});

describe("bracketNegotiationStatus", () => {
  const offered = bracket({ scheduling_proposals: [proposal()] });

  it("reads as They proposed for the team that has to answer", () => {
    expect(bracketNegotiationStatus(offered, captain2)).toBe("pending-me");
    expect(bracketNegotiationStatus(offered, admin)).toBe("pending-me");
  });

  it("reads as Awaiting opponent for the proposer and for onlookers", () => {
    expect(bracketNegotiationStatus(offered, captain1)).toBe("pending-them");
    expect(bracketNegotiationStatus(offered, spectator)).toBe("pending-them");
  });

  it("is Agreed once a time is on the bracket or its match", () => {
    expect(
      bracketNegotiationStatus(
        bracket({ scheduled_at: "2026-10-03T20:00:00.000Z" }),
        spectator,
      ),
    ).toBe("agreed");
    expect(
      bracketNegotiationStatus(
        bracket({
          match: {
            id: "m",
            status: "Scheduled",
            scheduled_at: "2026-10-03T20:00:00.000Z",
          },
        }),
        spectator,
      ),
    ).toBe("agreed");
  });

  it("is Not scheduled when nothing is agreed or on the table", () => {
    expect(
      bracketNegotiationStatus(
        bracket({
          scheduling_proposals: [proposal({ status: "Declined" })],
        }),
        captain2,
      ),
    ).toBe("default");
  });
});

describe("bracketProposalWindow", () => {
  const windows = [
    {
      round: 2,
      opens_at: "2026-10-01T00:00:00.000Z",
      closes_at: "2026-10-04T23:59:00.000Z",
      default_match_at: "2026-10-03T19:00:00.000Z",
    },
  ];

  it("uses the stage window for the bracket's round", () => {
    expect(bracketProposalWindow(windows, bracket(), NOW)).toEqual({
      opensAt: "2026-10-01T00:00:00.000Z",
      closesAt: "2026-10-04T23:59:00.000Z",
      defaultMatchAt: "2026-10-03T19:00:00.000Z",
    });
  });

  it("falls back to the next two weeks when the round has no window", () => {
    expect(bracketProposalWindow(windows, bracket({ round: 3 }), NOW)).toEqual(
      {
        opensAt: NOW.toISOString(),
        closesAt: new Date(NOW.getTime() + 14 * DAY).toISOString(),
        defaultMatchAt: null,
      },
    );
    expect(bracketProposalWindow(undefined, bracket(), NOW).closesAt).toBe(
      new Date(NOW.getTime() + 14 * DAY).toISOString(),
    );
  });

  it("caps an open-ended window at two weeks", () => {
    const openEnded = [{ round: 2, opens_at: null, closes_at: null }];

    expect(bracketProposalWindow(openEnded, bracket(), NOW)).toEqual({
      opensAt: NOW.toISOString(),
      closesAt: new Date(NOW.getTime() + 14 * DAY).toISOString(),
      defaultMatchAt: null,
    });
  });
});
