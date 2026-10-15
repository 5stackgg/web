import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamGlobal from "~/components/StreamGlobal.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import {
  embedStreamKey,
  liveStreamKey,
  useStoppedStreams,
} from "~/composables/useStoppedStreams";

const gameStreamer = {
  id: "g1",
  match_id: "m-1",
  link: "https://stream.example/m-1",
  is_game_streamer: true,
  preview: true,
};
const twitch = {
  id: "s1",
  match_id: "m-1",
  link: "https://twitch.tv/northside",
  preview: true,
};
const pov = {
  id: "twitch-pov:76561198000000001",
  match_id: "m-1",
  link: "https://www.twitch.tv/kappa_cs",
  is_pov: true,
  steam_id: "76561198000000001",
  preview: true,
};

let unmount: (() => void) | undefined;

async function closeFloatingPlayer(stream: object, route: string) {
  useApplicationSettingsStore().setGlobalStream(stream as any);
  const wrapper = await mountSuspended(StreamGlobal, {
    route,
    global: { stubs: { LiveStreamPlayer: true, StreamEmbed: true } },
  });
  unmount = () => wrapper.unmount();
  const close = wrapper
    .findAll("button")
    .find((button) => button.text() === "Close");
  await close!.trigger("click");
}

describe("StreamGlobal close", () => {
  const stopped = useStoppedStreams();

  beforeEach(() => {
    stopped.resume(liveStreamKey("m-1"));
    stopped.resume(embedStreamKey(twitch));
    stopped.resume(embedStreamKey(pov));
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it("stops the stream on its own match page instead of handing it back", async () => {
    await closeFloatingPlayer(gameStreamer, "/matches/m-1");

    expect(useApplicationSettingsStore().globalStream).toBeNull();
    expect(stopped.isStopped(liveStreamKey("m-1"))).toBe(true);
  });

  it("stops an embedded stream by its own row", async () => {
    await closeFloatingPlayer(twitch, "/matches/m-1");

    expect(stopped.isStopped(embedStreamKey(twitch))).toBe(true);
    expect(stopped.isStopped(liveStreamKey("m-1"))).toBe(false);
  });

  it("stops a player's POV for this match only", async () => {
    await closeFloatingPlayer(pov, "/matches/m-1");

    expect(stopped.isStopped(embedStreamKey(pov))).toBe(true);
    expect(
      stopped.isStopped(embedStreamKey({ ...pov, match_id: "m-2" })),
    ).toBe(false);
  });

  it("only closes on any other page", async () => {
    await closeFloatingPlayer(gameStreamer, "/watch");

    expect(useApplicationSettingsStore().globalStream).toBeNull();
    expect(stopped.isStopped(liveStreamKey("m-1"))).toBe(false);
  });
});
