import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamGlobal from "~/components/StreamGlobal.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const MATCH = "2b7a3c4d-1111-4222-8333-944455556666";
const KAPPA = "76561198000000001";

const floatingPov = {
  id: `twitch-pov:${KAPPA}`,
  link: "https://www.twitch.tv/kappa_cs",
  title: "kappa POV",
  is_pov: true,
  steam_id: KAPPA,
  match_id: MATCH,
  preview: true,
};

let returned: unknown[];
let fetched: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

async function mountFloating(stream: object) {
  useApplicationSettingsStore().setGlobalStream(stream as any);
  const wrapper = await mountSuspended(StreamGlobal, {
    route: "/watch",
    global: { stubs: { LiveStreamPlayer: true, StreamEmbed: true } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  returned = [{ steam_id: KAPPA, name: "kappa", login: "kappa_cs" }];
  fetched = vi.fn((url: string) =>
    String(url).endsWith(`/twitch/matches/${MATCH}/streams`)
      ? Promise.resolve({ streams: returned })
      : Promise.reject(new Error(`unexpected ${url}`)),
  );
  vi.stubGlobal("$fetch", fetched);
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.unstubAllGlobals();
  useApplicationSettingsStore().setGlobalStream();
});

describe("a player POV in the floating player", () => {
  it("stays while the api still returns it", async () => {
    await mountFloating(floatingPov);

    expect(fetched).toHaveBeenCalledTimes(1);
    expect(useApplicationSettingsStore().globalStream).not.toBeNull();
  });

  it("is let go as soon as the api stops returning it", async () => {
    returned = [];
    await mountFloating(floatingPov);

    expect(useApplicationSettingsStore().globalStream).toBeNull();
  });

  it("leaves organizer streams alone", async () => {
    await mountFloating({
      id: "s1",
      match_id: MATCH,
      link: "https://twitch.tv/northside",
      preview: true,
    });

    expect(fetched).not.toHaveBeenCalled();
    expect(useApplicationSettingsStore().globalStream).not.toBeNull();
  });
});
