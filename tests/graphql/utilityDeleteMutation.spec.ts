import { describe, expect, it } from "vitest";
import { print } from "graphql";
import { deleteUtilityLineupMutation } from "~/graphql/utilityGraphql";

// Only the api's action takes a lineup's clips and stills out of S3 with it;
// deleting the row directly left them in the bucket.
describe("deleting a lineup", () => {
  it("goes through the api's action, not a direct delete", () => {
    const text = print(deleteUtilityLineupMutation);

    expect(text).toContain(
      "deleteUtilityLineup(utility_lineup_id: $utility_lineup_id)",
    );
    expect(text).not.toContain("delete_utility_lineups");
  });
});
