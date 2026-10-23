import { describe, expect, it } from "vitest";
import { print } from "graphql";
import { runningUtilityPracticeSessionsSubscription } from "~/graphql/utilityGraphql";

describe("runningUtilityPracticeSessionsSubscription", () => {
  const document = print(runningUtilityPracticeSessionsSubscription).replace(
    /\s+/g,
    " ",
  );

  it("asks for every starting or ready server that is not a render, newest first", () => {
    expect(document).toContain(
      "utility_practice_sessions( where: {status: {_in: $statuses}, is_render: {_eq: false}} order_by: [{created_at: desc}] )",
    );
    expect(document).toContain(
      "$statuses: [e_utility_practice_statuses_enum!]",
    );
  });

  it("selects what a row shows and whether it may be stopped", () => {
    for (const field of [
      "host_steam_id",
      "host { steam_id name avatar_url }",
      "map_name",
      "region",
      "status",
      "map_changing_at",
      "created_at",
      "connected_players",
      "max_players",
      "can_stop",
    ]) {
      expect(document).toContain(field);
    }
  });

  it("selects the server, match and connect string the console panel needs", () => {
    for (const field of ["server_id", "match_id", "connection_string"]) {
      expect(document).toContain(field);
    }
  });
});
