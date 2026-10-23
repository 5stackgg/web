import { describe, expect, it } from "vitest";
import { parse, print } from "graphql";
import {
  joinShared,
  readsShared,
  splitSubscription,
} from "~/utilities/sharedSubscription";

const flat = (document: any) =>
  print(typeof document === "string" ? parse(document) : document)
    .replace(/\s+/g, " ")
    .trim();

const DOCUMENT = parse(`
  subscription ($id: uuid!, $order: order_by) {
    tournaments_by_pk(id: $id) {
      id
      name
      can_join
      teams(order_by: { seed: $order }) {
        id
        name
        can_manage
        roster { player { steam_id } }
      }
      counts: teams { id roster_aggregate { aggregate { count } } }
      stages {
        id
        brackets {
          id
          round
          match { id status }
        }
      }
    }
  }
`);

const PERSONAL = ["can_join", "teams.can_manage", "stages.brackets.match"];

describe("splitSubscription", () => {
  const { shared, personal } = splitSubscription(DOCUMENT, PERSONAL);

  it("leaves the personal fields out of the shared half", () => {
    expect(flat(shared)).toBe(
      flat(`
        subscription ($id: uuid!, $order: order_by) {
          tournaments_by_pk(id: $id) {
            id
            name
            teams(order_by: { seed: $order }) {
              id
              name
              roster { player { steam_id } }
            }
            counts: teams { id roster_aggregate { aggregate { count } } }
            stages { id brackets { id round } }
          }
        }
      `),
    );
  });

  it("keeps only the personal fields, with each level's id and arguments", () => {
    expect(flat(personal)).toBe(
      flat(`
        subscription ($id: uuid!, $order: order_by) {
          tournaments_by_pk(id: $id) {
            id
            can_join
            teams(order_by: { seed: $order }) { id can_manage }
            stages { id brackets { id match { id status } } }
          }
        }
      `),
    );
  });

  it("drops the variables the personal half no longer uses", () => {
    const { personal } = splitSubscription(DOCUMENT, ["can_join"]);

    expect(flat(personal)).toBe(
      flat(`
        subscription ($id: uuid!) {
          tournaments_by_pk(id: $id) { id can_join }
        }
      `),
    );
  });
});

describe("joinShared", () => {
  it("lays the viewer's fields over the shared rows by id", () => {
    const shared = {
      id: "t",
      name: "Cup",
      teams: [
        { id: "a", name: "A", roster: [] },
        { id: "b", name: "B", roster: [] },
      ],
      stages: [{ id: "s", brackets: [{ id: "x", round: 1 }] }],
    };
    const personal = {
      id: "t",
      can_join: true,
      teams: [
        { id: "b", can_manage: true },
        { id: "a", can_manage: false },
      ],
      stages: [
        {
          id: "s",
          brackets: [{ id: "x", match: { id: "m", status: "Live" } }],
        },
      ],
    };

    expect(joinShared(shared, personal)).toEqual({
      id: "t",
      name: "Cup",
      can_join: true,
      teams: [
        { id: "a", name: "A", roster: [], can_manage: false },
        { id: "b", name: "B", roster: [], can_manage: true },
      ],
      stages: [
        {
          id: "s",
          brackets: [{ id: "x", round: 1, match: { id: "m", status: "Live" } }],
        },
      ],
    });
  });

  it("keeps a shared row the personal half has nothing for", () => {
    expect(
      joinShared({ teams: [{ id: "a", name: "A" }] }, { teams: [] }),
    ).toEqual({ teams: [{ id: "a", name: "A" }] });
  });
});

describe("readsShared", () => {
  it("shares for signed-out visitors, players, verified players and streamers", () => {
    expect(
      [undefined, null, "user", "verified_user", "streamer"].map((role) =>
        readsShared(role),
      ),
    ).toEqual([true, true, true, true, true]);
    expect(
      ["moderator", "match_organizer", "administrator"].map((role) =>
        readsShared(role),
      ),
    ).toEqual([false, false, false]);
  });
});
