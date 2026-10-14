import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import {
  useMatchTwitchPovs,
  useTwitchLiveSteamIds,
  useTwitchPlayer,
  useTwitchPovGuard,
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

function badGateway() {
  return Object.assign(new Error("Bad Gateway"), { statusCode: 502 });
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

  it("keeps the last known stream through an outage (only a 404 hides it)", async () => {
    fetched.mockResolvedValueOnce(live).mockRejectedValueOnce(badGateway());
    const { stream } = run(() => useTwitchPlayer(PLAYER));
    await flushPromises();

    await vi.advanceTimersByTimeAsync(60_000);
    await flushPromises();

    expect(calls(`/twitch/players/${PLAYER}`)).toBe(2);
    expect(stream.value).toEqual(live);
  });

  it("stops asking while the tab is hidden and nothing is playing", async () => {
    fetched.mockResolvedValue(live);
    run(() => useTwitchPlayer(PLAYER));
    await flushPromises();

    setVisibility("hidden");
    await nextTick();
    await vi.advanceTimersByTimeAsync(180_000);

    expect(calls(`/twitch/players/${PLAYER}`)).toBe(1);
  });

  it("keeps checking every 20 seconds while the stream plays, even in a hidden tab, and cuts it on a 404", async () => {
    fetched.mockResolvedValue(live);
    const playing = ref(false);
    const { stream } = run(() => useTwitchPlayer(PLAYER, { playing }));
    await flushPromises();

    playing.value = true;
    await nextTick();
    await flushPromises();
    setVisibility("hidden");
    await nextTick();
    await flushPromises();
    const checked = calls(`/twitch/players/${PLAYER}`);

    await vi.advanceTimersByTimeAsync(20_000);
    await flushPromises();
    expect(calls(`/twitch/players/${PLAYER}`)).toBe(checked + 1);

    fetched.mockRejectedValue(notFound());
    await vi.advanceTimersByTimeAsync(20_000);
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

  it("keeps the same list object when only the viewer order changed", async () => {
    const OTHER = "76561198000000005";
    fetched
      .mockResolvedValueOnce({ steam_ids: [PLAYER, OTHER] })
      .mockResolvedValueOnce({ steam_ids: [OTHER, PLAYER] });
    const { steamIds } = run(() => useTwitchLiveSteamIds());
    await flushPromises();
    const first = steamIds.value;

    await vi.advanceTimersByTimeAsync(60_000);
    await flushPromises();

    expect(calls("/twitch/live")).toBe(2);
    expect(steamIds.value).toBe(first);
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
  it("polls a Live match's POVs, every 20 seconds while one is listed", async () => {
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

    await vi.advanceTimersByTimeAsync(20_000);
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

  it("keeps the POVs through an outage, and drops them on a 404", async () => {
    fetched
      .mockResolvedValueOnce({ streams: [pov] })
      .mockRejectedValueOnce(badGateway())
      .mockRejectedValueOnce(notFound());
    const { streams } = run(() =>
      useMatchTwitchPovs({ id: MATCH, status: "Live" }),
    );
    await flushPromises();

    await vi.advanceTimersByTimeAsync(20_000);
    await flushPromises();
    expect(streams.value).toEqual([pov]);

    await vi.advanceTimersByTimeAsync(20_000);
    await flushPromises();
    expect(streams.value).toEqual([]);
  });

  it("keeps checking every 20 seconds while a POV may be playing, even in a hidden tab", async () => {
    fetched.mockResolvedValue({ streams: [pov] });
    run(() => useMatchTwitchPovs({ id: MATCH, status: "Live" }));
    await flushPromises();

    setVisibility("hidden");
    await nextTick();
    await flushPromises();
    const checked = calls("/streams");
    await vi.advanceTimersByTimeAsync(20_000);
    await flushPromises();

    expect(calls("/streams")).toBe(checked + 1);
  });

  it("stops polling while the tab is hidden and no POV is listed, and catches up when it comes back", async () => {
    fetched.mockResolvedValue({ streams: [] });
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

  it("polls every 45 seconds while no POV is listed", async () => {
    fetched.mockResolvedValue({ streams: [] });
    run(() => useMatchTwitchPovs({ id: MATCH, status: "Live" }));
    await flushPromises();

    await vi.advanceTimersByTimeAsync(20_000);
    expect(calls("/streams")).toBe(1);

    await vi.advanceTimersByTimeAsync(25_000);
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

describe("useTwitchPovGuard", () => {
  const floating = {
    id: `twitch-pov:${PLAYER}`,
    is_pov: true,
    steam_id: PLAYER,
    match_id: MATCH,
  };

  it("re-checks a floating POV every 20 seconds, even in a hidden tab, and lets it go once it is not returned", async () => {
    fetched.mockResolvedValue({ streams: [pov] });
    const gone = vi.fn();
    run(() => useTwitchPovGuard(floating, gone));
    await flushPromises();
    expect(fetched).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/twitch/matches/${MATCH}/streams$`)),
      expect.objectContaining({ credentials: "include" }),
    );

    setVisibility("hidden");
    await nextTick();
    await flushPromises();
    fetched.mockResolvedValue({ streams: [] });
    await vi.advanceTimersByTimeAsync(20_000);
    await flushPromises();

    expect(gone).toHaveBeenCalledTimes(1);
  });

  it("lets it go on a 404 but not through an outage", async () => {
    fetched.mockRejectedValueOnce(badGateway());
    const gone = vi.fn();
    run(() => useTwitchPovGuard(floating, gone));
    await flushPromises();
    expect(gone).not.toHaveBeenCalled();

    fetched.mockRejectedValueOnce(notFound());
    await vi.advanceTimersByTimeAsync(20_000);
    await flushPromises();
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it("leaves every other stream alone", async () => {
    const gone = vi.fn();
    run(() =>
      useTwitchPovGuard(
        { id: "stream-1", link: "https://www.twitch.tv/caster" },
        gone,
      ),
    );
    await flushPromises();

    expect(fetched).not.toHaveBeenCalled();
    expect(gone).not.toHaveBeenCalled();
  });
});
