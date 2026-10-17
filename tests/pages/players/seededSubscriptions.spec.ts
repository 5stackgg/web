import { describe, expect, it } from "vitest";
import PlayerPage from "~/pages/players/[id].vue";

describe("the player page's seeded subscriptions", () => {
  it("renders the hero and the awards from an HTTP answer", () => {
    const subscriptions = (PlayerPage as any).apollo.$subscribe;

    expect(subscriptions.players_by_pk.context).toEqual({ seed: true });
    expect(subscriptions.playerAwards.context).toEqual({ seed: true });
  });
});
