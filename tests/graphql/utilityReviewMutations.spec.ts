import { describe, expect, it } from "vitest";
import { print } from "graphql";
import {
  approveUtilityLineupPublicMutation,
  rejectUtilityLineupPublicMutation,
} from "~/graphql/utilityGraphql";

// An unset variable in a _set reaches Hasura as null, so the one document
// that answered both ways turned every rejection into visibility: null.
describe("answering a request to publish", () => {
  it("approves by setting the enum itself, not a variable", () => {
    const text = print(approveUtilityLineupPublicMutation);

    expect(text).toMatch(/visibility: Public\b/);
    expect(text).not.toContain("$visibility");
    expect(text).not.toContain("public_requested_at:");
  });

  it("rejects without touching visibility", () => {
    const text = print(rejectUtilityLineupPublicMutation);
    const set = text.slice(text.indexOf("_set"), text.indexOf("}", text.indexOf("_set")));

    expect(set).not.toContain("visibility");
    expect(set).toContain("public_requested_at: null");
    expect(set).toContain("public_review_note: $public_review_note");
  });
});
