import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { e_player_roles_enum } from "~/generated/zeus";

const onLanReply = vi.hoisted(() => ({ value: true }));

const connect = vi.hoisted(() =>
  vi.fn(async (region: string, onMessage: (data: string) => void) => ({
    send: () =>
      onMessage(
        JSON.stringify({
          type: "latency-results",
          data: { region, latency: 1, isLan: onLanReply.value },
        }),
      ),
    close: vi.fn(),
  })),
);

vi.mock("~/web-sockets/Webrtc", () => ({ webrtc: { connect } }));

const MINUTE = 60 * 1000;

const region = (value: string, is_lan = false) => ({
  value,
  description: value,
  is_lan,
  status: "Online",
  has_node: true,
});

function signIn() {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Player",
    role: e_player_roles_enum.user,
  } as ReturnType<typeof useAuthStore>["me"];
}

const probedRegions = () => connect.mock.calls.map(([value]) => value);
const lanProbes = () => probedRegions().filter((value) => value === "Lan").length;

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
  connect.mockClear();
  onLanReply.value = true;
  signIn();
  useApplicationSettingsStore().availableRegions = [
    region("eu"),
    region("Lan", true),
  ];
});

afterEach(() => {
  vi.useRealTimers();
});

async function loadWithStoredReadings() {
  const matchmaking = useMatchmakingStore();
  matchmaking.latencies.set("eu", { isLan: false, latency: 20 } as never);
  matchmaking.latencies.set("Lan", {
    isLan: onLanReply.value,
    latency: 1,
  } as never);
  matchmaking.checkLatenies();
  await vi.advanceTimersByTimeAsync(0);
  return matchmaking;
}

describe("MatchmakingStore LAN probe", () => {
  it("probes the LAN behind stored readings once a page load, then every 45 minutes while on it", async () => {
    const matchmaking = await loadWithStoredReadings();
    expect(probedRegions()).toEqual(["Lan"]);

    matchmaking.checkLatenies();
    await vi.advanceTimersByTimeAsync(44 * MINUTE);
    expect(probedRegions()).toEqual(["Lan"]);

    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(probedRegions()).toEqual(["Lan", "Lan"]);
  });

  it("tries again 5 minutes after a probe loses the LAN", async () => {
    const matchmaking = await loadWithStoredReadings();
    expect(matchmaking.onLan).toBe(true);

    onLanReply.value = false;
    await vi.advanceTimersByTimeAsync(45 * MINUTE);
    expect(matchmaking.onLan).toBe(false);

    onLanReply.value = true;
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(probedRegions()).toEqual(["Lan", "Lan", "Lan"]);
    expect(matchmaking.onLan).toBe(true);
  });

  it("leaves a player who is not on the LAN alone after the page load probe", async () => {
    onLanReply.value = false;
    await loadWithStoredReadings();

    await vi.advanceTimersByTimeAsync(3 * 60 * MINUTE);
    expect(probedRegions()).toEqual(["Lan"]);
  });

  it("starts once the LAN regions arrive", async () => {
    useApplicationSettingsStore().availableRegions = [region("eu")];
    const matchmaking = useMatchmakingStore();
    matchmaking.latencies.set("eu", { isLan: false, latency: 20 } as never);
    matchmaking.checkLatenies();
    await vi.advanceTimersByTimeAsync(0);
    expect(lanProbes()).toBe(0);

    useApplicationSettingsStore().availableRegions = [
      region("eu"),
      region("Lan", true),
    ];
    matchmaking.checkLatenies();
    await vi.advanceTimersByTimeAsync(0);
    expect(lanProbes()).toBe(1);

    await vi.advanceTimersByTimeAsync(45 * MINUTE);
    expect(lanProbes()).toBe(2);
  });

  it("tries again 5 minutes after any probe drops the LAN reading", async () => {
    const matchmaking = await loadWithStoredReadings();
    expect(lanProbes()).toBe(1);

    matchmaking.latencies.delete("Lan");
    await vi.advanceTimersByTimeAsync(0);
    expect(matchmaking.onLan).toBe(false);

    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(lanProbes()).toBe(2);
    expect(matchmaking.onLan).toBe(true);
  });
});
