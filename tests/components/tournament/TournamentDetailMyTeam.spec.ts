// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import TournamentDetail from "~/components/tournament/TournamentDetail.vue";

const { computed } = TournamentDetail as any;

const ME = "76561198000000001";

const entry = (id: string, players: string[]) => ({
  id,
  name: id,
  roster: players.map((steam_id) => ({ player: { steam_id } })),
});

const myTeam = (myTeams: any[], selectedMyTeamId: string | null = null) =>
  computed.myTeam.call({ myTeams, selectedMyTeamId, me: { steam_id: ME } });

describe("TournamentDetail my team", () => {
  it("opens on the entry the viewer plays on", () => {
    const managed = entry("managed", ["76561198000000002"]);
    const playing = entry("playing", [ME]);

    expect(myTeam([managed, playing]).id).toBe("playing");
  });

  it("follows the entry picked in the switcher", () => {
    const managed = entry("managed", ["76561198000000002"]);
    const playing = entry("playing", [ME]);

    expect(myTeam([managed, playing], "managed").id).toBe("managed");
  });

  it("falls back to the first entry when the viewer plays on none", () => {
    const first = entry("first", []);
    const second = entry("second", []);

    expect(myTeam([first, second]).id).toBe("first");
  });

  it("drops a pick whose entry has gone", () => {
    const playing = entry("playing", [ME]);

    expect(myTeam([playing], "withdrawn").id).toBe("playing");
  });
});
