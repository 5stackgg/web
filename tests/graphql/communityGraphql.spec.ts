// @vitest-environment node
import { describe, expect, it } from "vitest";
import { print } from "graphql";
import {
  SERVER_RECENT_PLAYERS_QUERY,
  SERVER_ROSTER_SUBSCRIPTION,
} from "~/graphql/communityGraphql";

const playerSelection = (document: Parameters<typeof print>[0]) =>
  /player \{([^}]*)\}/.exec(print(document))?.[1].split(/\s+/) ?? [];

describe("community roster documents", () => {
  it.each([
    ["live roster", SERVER_ROSTER_SUBSCRIPTION],
    ["recent players", SERVER_RECENT_PLAYERS_QUERY],
  ])(
    "asks for each %s player's role, which decides who may sanction them",
    (_, document) => {
      expect(playerSelection(document)).toContain("role");
    },
  );
});
