import { describe, expect, it, vi } from "vitest";
import gql from "graphql-tag";
import { print } from "graphql";
import { fromActiveMatches } from "~/utilities/activeMatches";

const api = vi.hoisted(() => ({ servesActiveMatches: true }));

vi.mock("~/utilities/schemaHasType", () => ({
  schemaHasType: async () => false,
  schemaHasField: async (_client: unknown, type: string, field: string) =>
    api.servesActiveMatches &&
    type === "subscription_root" &&
    field === "active_matches",
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
