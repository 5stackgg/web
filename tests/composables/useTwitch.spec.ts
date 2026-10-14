import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import {
  useMatchTwitchPovs,
  useTwitchLiveSteamIds,
  useTwitchPlayer,
} from "~/composables/useTwitch";

const PLAYER = "76561198000000002";
const MATCH = "2b7a3c4d-1111-4222-8333-944455556666";

const live = {
  steam_id: PLAYER,
  login: "kappa_cs",
  display_name: "kappa_cs",
  is_live: true,
  title: "FACEIT grind",
  game_name: "Counter-Strike",
  viewer_count: 1204,
  started_at: "2026-10-14T10:00:00Z",
  thumbnail_url: "https://static-cdn.jtvnw.net/previews-ttv/live_user_kappa_cs-640x360.jpg",
};

const pov = {
  steam_id: PLAYER,
  name: "kappa",
  avatar_url: null,
  match_lineup_id: "lineup-1",
  login: "kappa_cs",
  display_name: "kappa_cs",
  title: "FACEIT grind",
  viewer_count: 1204,
  started_at: "2026-10-14T10:00:00Z",
  thumbnail_url: null,
};

let fetched: ReturnType<typeof vi.fn>;
let scope: ReturnType<typeof effectScope> | undefined;

function notFound() {
  return Object.assign(new Error("Not Found"), { statusCode: 404 });
}

function run<T>(fn: () => T): T {
  scope = effectScope();
  return scope.run(fn)!;
}

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  document.dispatchEvent(new Event("visibilitychange"));
}

const calls = (path: string) =>
  fetched.mock.calls.filter(([url]) => String(url).endsWith(path)).length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fetched = vi.fn();
  vi.stubGlobal("$fetch", fetched);
  useApplicationSettingsStore().settings = [
    { name: "public.supports_twitch", value: "true" },
  ];
});

afterEach(() => {
  scope?.stop();
  scope = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useApplicationSettingsStore().settings = [];
});

describe("useTwitchPlayer", () => {
  it("asks the api for the player's stream with the session cookie", async () => {
    fetched.mockResolvedValue(live);
    const { stream } = run(() => useTwitchPlayer(PLAYER));
    await flushPromises();

    expect(fetched).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/twitch/players/${PLAYER}$`)),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(stream.value).toEqual(live);
  });

  it("shows nothing when the api has nothing to show (404)", async () => {
    fetched.mockRejectedValue(notFound());
    const { stream } = run(() => useTwitchPlayer(PLAYER));
    await flushPromises();

    expect(stream.value).toBeNull();
  });

  it("drops a stream the api stops returning, so a player who joins your match disappears", async () => {
    fetched.mockResolvedValueOnce(live).mockRejectedValueOnce(notFound());
    const { stream } = run(() => useTwitchPlayer(PLAYER));
    await flushPromises();
    expect(stream.value).not.toBeNull();

    await vi.advanceTimersByTimeAsync(60_000);
    await flushPromises();

    expect(stream.value).toBeNull();
  });

  it("never asks while Twitch is not set up", async () => {
    useApplicationSettingsStore().settings = [];
    const { stream } = run(() => useTwitchPlayer(PLAYER));
    await flushPromises();

    expect(fetched).not.toHaveBeenCalled();
    expect(stream.value).toBeNull();
  });

  it("forgets the last profile's stream as soon as another profile opens", async () => {
    let resolveSecond: (value: unknown) => void = () => {};
    fetched
      .mockResolvedValueOnce(live)
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    const steamId = ref(PLAYER);
    const { stream } = run(() => useTwitchPlayer(steamId));
    await flushPromises();
    expect(stream.value).not.toBeNull();

    steamId.value = "76561198000000003";
    await nextTick();

    expect(stream.value).toBeNull();
    resolveSecond(null);
  });
});

describe("useTwitchLiveSteamIds", () => {
  it("loads who is live and refreshes it every minute", async () => {
    fetched
      .mockResolvedValueOnce({ steam_ids: [PLAYER] })
      .mockResolvedValueOnce({ steam_ids: [] });
    const { steamIds, loaded } = run(() => useTwitchLiveSteamIds());
    await flushPromises();

    expect(loaded.value).toBe(true);
    expect(steamIds.value).toEqual([PLAYER]);

    await vi.advanceTimersByTimeAsync(60_000);
    await flushPromises();

    expect(steamIds.value).toEqual([]);
  });

  it("keeps the same list object when nobody went live or offline", async () => {
    fetched.mockResolvedValue({ steam_ids: [PLAYER] });
    const { steamIds } = run(() => useTwitchLiveSteamIds());
    await flushPromises();
    const first = steamIds.value;

    await vi.advanceTimersByTimeAsync(60_000);
    await flushPromises();

    expect(calls("/twitch/live")).toBe(2);
    expect(steamIds.value).toBe(first);
  });
});

describe("useMatchTwitchPovs", () => {
  it("polls a Live match's POVs every 45 seconds", async () => {
    fetched.mockResolvedValue({ streams: [pov] });
    const { streams } = run(() =>
      useMatchTwitchPovs({ id: MATCH, status: "Live" }),
    );
    await flushPromises();

    expect(fetched).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/twitch/matches/${MATCH}/streams$`)),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(streams.value).toEqual([pov]);

    await vi.advanceTimersByTimeAsync(45_000);
    await flushPromises();

    expect(calls("/streams")).toBe(2);
  });

  it("never asks for a match that is not Live", async () => {
    run(() => useMatchTwitchPovs({ id: MATCH, status: "Veto" }));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(180_000);

    expect(fetched).not.toHaveBeenCalled();
  });

  it("never asks while the viewer plays or coaches in the match", async () => {
    run(() =>
      useMatchTwitchPovs({ id: MATCH, status: "Live", is_in_lineup: true }),
    );
    run(() => useMatchTwitchPovs({ id: MATCH, status: "Live", is_coach: true }));
    await flushPromises();

    expect(fetched).not.toHaveBeenCalled();
  });

  it("stops polling and clears the POVs once the match leaves Live", async () => {
    fetched.mockResolvedValue({ streams: [pov] });
    const match = ref({ id: MATCH, status: "Live" });
    const { streams } = run(() => useMatchTwitchPovs(match));
    await flushPromises();
    expect(streams.value).toHaveLength(1);

    match.value = { id: MATCH, status: "Finished" };
    await nextTick();
    await vi.advanceTimersByTimeAsync(180_000);
    await flushPromises();

    expect(streams.value).toEqual([]);
    expect(calls("/streams")).toBe(1);
  });

  it("stops polling while the tab is hidden and catches up when it comes back", async () => {
    fetched.mockResolvedValue({ streams: [pov] });
    run(() => useMatchTwitchPovs({ id: MATCH, status: "Live" }));
    await flushPromises();
    expect(calls("/streams")).toBe(1);

    setVisibility("hidden");
    await nextTick();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(calls("/streams")).toBe(1);

    setVisibility("visible");
    await nextTick();
    await flushPromises();
    expect(calls("/streams")).toBe(2);
  });

  it("stops when the page that asked goes away", async () => {
    fetched.mockResolvedValue({ streams: [pov] });
    run(() => useMatchTwitchPovs({ id: MATCH, status: "Live" }));
    await flushPromises();

    scope?.stop();
    await vi.advanceTimersByTimeAsync(180_000);

    expect(calls("/streams")).toBe(1);
  });
});
