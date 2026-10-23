import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchSelectServer from "~/components/match/MatchSelectServer.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const region = (value: string, is_lan = false) => ({
  value,
  description: value,
  is_lan,
  status: "Online",
  has_node: true,
});

const signIn = (role: e_player_roles_enum) => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Organizer",
    role,
  } as ReturnType<typeof useAuthStore>["me"];
};

beforeEach(() => {
  useApplicationSettingsStore().availableRegions = [
    region("eu"),
    region("Lan", true),
    region("Lan2", true),
    region("Lan3", true),
  ];
  useMatchmakingStore().latencies.set("Lan", {
    isLan: true,
    latency: 1,
  } as never);
});

afterEach(() => {
  useAuthStore().me = undefined;
  useApplicationSettingsStore().availableRegions = [];
  useMatchmakingStore().latencies.clear();
});

async function offered(match: Record<string, unknown>) {
  const wrapper = await mountSuspended(MatchSelectServer, {
    props: { match: { id: "match-1", server_id: null, ...match } },
  });
  return (wrapper.vm as any).regions.map(
    (entry: { value: string }) => entry.value,
  );
}

describe("MatchSelectServer LAN regions", () => {
  it("offers a match's organizer the LANs the match is on and the one they are on", async () => {
    signIn(e_player_roles_enum.user);
    expect(
      await offered({ region: "eu", options: { regions: ["eu", "Lan2"] } }),
    ).toEqual(["eu", "Lan", "Lan2"]);
  });

  it("offers a match organizer every LAN", async () => {
    signIn(e_player_roles_enum.match_organizer);
    expect(
      await offered({ region: "eu", options: { regions: ["eu"] } }),
    ).toEqual(["eu", "Lan", "Lan2", "Lan3"]);
  });
});
