import { describe, expect, it, vi } from "vitest";
import gql from "graphql-tag";
import { print } from "graphql";
import {
  fromActiveMatches,
  fromMyActiveMatches,
} from "~/utilities/activeMatches";

const api = vi.hoisted(() => ({
  servesActiveMatches: true,
  servesMyActiveMatches: true,
}));

vi.mock("~/utilities/schemaHasType", () => ({
  schemaHasType: async () => false,
  schemaHasField: async (_client: unknown, type: string, field: string) =>
    type === "subscription_root" &&
    ((field === "active_matches" && api.servesActiveMatches) ||
      (field === "my_active_matches" && api.servesMyActiveMatches)),
}));

const client = {} as any;

const document = gql`
  subscription ($statuses: [e_match_status_enum!]) {
    matches(where: { status: { _in: $statuses } }, limit: 5) {
      id
      lineup_1 {
        team {
          matches {
            id
          }
        }
      }
    }
    live: matches_aggregate(where: { status: { _eq: Live } }) {
      aggregate {
        count
      }
    }
    players {
      steam_id
    }
  }
`;

describe("fromActiveMatches", () => {
  it("reads the top-level matches fields from active_matches under the same keys", async () => {
    const before = print(document);
    const after = print(await fromActiveMatches(client, document));

    expect(after).toBe(
      before
        .replace(/^  matches\(/m, "  matches: active_matches(")
        .replace(
          /^  live: matches_aggregate\(/m,
          "  live: active_matches_aggregate(",
        ),
    );
    expect(print(document)).toBe(before);
  });

  it("leaves the document alone until the API serves active_matches", async () => {
    api.servesActiveMatches = false;
    expect(await fromActiveMatches(client, document)).toBe(document);
    api.servesActiveMatches = true;
  });
});

describe("fromMyActiveMatches", () => {
  const myMatches = gql`
    subscription {
      matches(where: { is_in_lineup: { _eq: true } }) {
        id
      }
    }
  `;

  it("reads my matches from my_active_matches under the matches key", async () => {
    expect(print(await fromMyActiveMatches(client, myMatches))).toBe(
      print(myMatches).replace(
        /^  matches\(/m,
        "  matches: my_active_matches(",
      ),
    );
  });

  it("reads them from active_matches until the API serves my_active_matches", async () => {
    api.servesMyActiveMatches = false;
    expect(print(await fromMyActiveMatches(client, myMatches))).toBe(
      print(myMatches).replace(/^  matches\(/m, "  matches: active_matches("),
    );
    api.servesMyActiveMatches = true;
  });

  it("leaves the document alone when the API serves neither", async () => {
    api.servesMyActiveMatches = false;
    api.servesActiveMatches = false;
    expect(await fromMyActiveMatches(client, myMatches)).toBe(myMatches);
    api.servesMyActiveMatches = true;
    api.servesActiveMatches = true;
  });
});
