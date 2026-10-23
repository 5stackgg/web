import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ScrimRegionPicker from "~/components/scrims/ScrimRegionPicker.vue";
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
    name: "Manager",
    role,
  } as ReturnType<typeof useAuthStore>["me"];
};

beforeEach(() => {
  useApplicationSettingsStore().availableRegions = [
    region("eu"),
    region("Lan", true),
    region("Lan2", true),
  ];
  useMatchmakingStore().latencies.set("Lan", {
    isLan: true,
    latency: 1,
  } as never);
  useMatchmakingStore().latencies.set("Lan2", {
    isLan: false,
    latency: 1,
  } as never);
});

afterEach(() => {
  useAuthStore().me = undefined;
  useApplicationSettingsStore().availableRegions = [];
  useMatchmakingStore().latencies.clear();
});

async function offered(listed: Array<string> = []) {
  const wrapper = await mountSuspended(ScrimRegionPicker, {
    props: { modelValue: listed },
  });
  return wrapper
    .findAll("button[aria-pressed]")
    .map((button) => button.find("span.truncate"))
    .filter((label) => label.exists())
    .map((label) => label.text())
    .sort();
}

describe("ScrimRegionPicker LAN regions", () => {
  it("offers a manager only the LAN the probe placed them on", async () => {
    signIn(e_player_roles_enum.user);
    expect(await offered()).toEqual(["Lan", "eu"]);
  });

  it("keeps a LAN region already listed so it can be taken off", async () => {
    signIn(e_player_roles_enum.user);
    expect(await offered(["Lan2"])).toEqual(["Lan", "Lan2", "eu"]);
  });

  it("offers a match organizer every LAN", async () => {
    signIn(e_player_roles_enum.match_organizer);
    expect(await offered()).toEqual(["Lan", "Lan2", "eu"]);
  });
});
