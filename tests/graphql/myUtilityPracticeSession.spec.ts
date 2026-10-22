import { describe, expect, it } from "vitest";
import { print } from "graphql";
import {
  myUtilityPracticeSessionQuery,
  myUtilityPracticeSessionSubscription,
} from "~/graphql/utilityGraphql";

describe.each([
  ["myUtilityPracticeSessionQuery", myUtilityPracticeSessionQuery],
  [
    "myUtilityPracticeSessionSubscription",
    myUtilityPracticeSessionSubscription,
  ],
])("%s", (_name, operation) => {
  const document = print(operation).replace(/\s+/g, " ");

  // Every role's matches filter hides practice matches, and Hasura applies it
  // through a relationship too, so a guest found through the match never is.
  it("finds a guest's session by is_member, not through the hidden match", () => {
    expect(document).toContain(
      "_or: [{host_steam_id: {_eq: $steam_id}}, {is_member: {_eq: true}}]",
    );
    expect(document).not.toContain("lineup_1");
    expect(document).not.toContain("match: {");
  });

  it("keeps the variables its callers already pass", () => {
    expect(document).toContain("$steam_id: bigint!");
    expect(document).toContain(
      "$statuses: [e_utility_practice_statuses_enum!]",
    );
    expect(document).toContain("status: {_in: $statuses}");
  });
});
