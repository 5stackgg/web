import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamEmbed from "~/components/StreamEmbed.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useTwitchPovGuard } from "~/composables/useTwitch";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
    },
  }),
}));

const organizer = {
  id: "stream-1",
  link: "https://www.youtube.com/watch?v=abc123",
  title: "Main broadcast",
  preview: true as const,
};

const MATCH = "2b7a3c4d-1111-4222-8333-944455556666";

const pov = (steamId: string, name: string, login: string) => ({
  id: `twitch-pov:${steamId}`,
  steam_id: steamId,
  match_id: MATCH,
  link: `https://www.twitch.tv/${login}`,
  title: `${name} POV`,
  name,
  avatar_url: null,
  is_pov: true,
  preview: true as const,
});

const kappa = pov("76561198000000001", "kappa", "kappa_cs");
const rook = pov("76561198000000002", "rook", "rook_tv");

let unmount: (() => void) | undefined;

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flushPromises();
}

async function mountEmbed(streams: unknown[]) {
  const wrapper = await mountSuspended(StreamEmbed, { props: { streams } });
  unmount = () => wrapper.unmount();
  await settle();
  return wrapper;
}

const chips = (wrapper: any) =>
  wrapper
    .findAll("button")
    .filter((button: any) =>
      /POV|Main broadcast/.test(button.text()),
    );

const chipNamed = (wrapper: any, name: string) =>
  chips(wrapper).find((button: any) => button.text().includes(name));

beforeEach(() => {
  useApplicationSettingsStore().setGlobalStream();
  vi.stubGlobal("Twitch", {
    Player: class {
      destroy() {}
      setMuted() {}
    },
  });
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.unstubAllGlobals();
  useApplicationSettingsStore().setGlobalStream();
});

describe("StreamEmbed with player POVs", () => {
  it("names every chip, so two Twitch streams can be told apart", async () => {
    const wrapper = await mountEmbed([organizer, kappa, rook]);

    expect(chips(wrapper).map((chip: any) => chip.text())).toEqual([
      "Main broadcast",
      "KAkappa POV",
      "ROrook POV",
    ]);
  });

  it("names POV chips even where the picker otherwise shows icons only", async () => {
    const wrapper = await mountSuspended(StreamEmbed, {
      props: { streams: [organizer, kappa], showTitle: false },
    });
    unmount = () => wrapper.unmount();
    await settle();

    expect(chipNamed(wrapper, "kappa POV")).toBeDefined();
    expect(chips(wrapper).map((chip: any) => chip.text())).not.toContain(
      "Main broadcast",
    );
  });

  it("labels the picture with whose POV it is", async () => {
    const wrapper = await mountEmbed([organizer, kappa]);
    expect(wrapper.find("[data-test='stream-pov-label']").exists()).toBe(false);

    await chipNamed(wrapper, "kappa POV").trigger("click");
    await settle();

    expect(wrapper.get("[data-test='stream-pov-label']").text()).toBe(
      "kappa POV",
    );
  });

  it("follows the first stream when the viewer picked nothing and an organizer stream appears", async () => {
    const wrapper = await mountEmbed([kappa]);
    expect(wrapper.get("[data-test='stream-pov-label']").text()).toBe(
      "kappa POV",
    );

    await wrapper.setProps({ streams: [organizer, kappa] });
    await settle();

    expect(wrapper.find("[data-test='stream-pov-label']").exists()).toBe(false);
    expect(wrapper.find("iframe").attributes("src")).toContain(
      "youtube.com/embed/abc123",
    );
  });

  it("stays on the POV picked when the list is refreshed", async () => {
    const wrapper = await mountEmbed([organizer, kappa, rook]);
    await chipNamed(wrapper, "rook POV").trigger("click");
    await settle();

    await wrapper.setProps({
      streams: [{ ...organizer, id: "stream-0" }, { ...kappa }, { ...rook }],
    });
    await settle();

    expect(wrapper.get("[data-test='stream-pov-label']").text()).toBe(
      "rook POV",
    );
  });

  it("goes back to the first stream when the POV picked goes offline", async () => {
    const wrapper = await mountEmbed([organizer, kappa, rook]);
    await chipNamed(wrapper, "rook POV").trigger("click");
    await settle();

    await wrapper.setProps({ streams: [organizer, kappa] });
    await settle();

    expect(wrapper.find("[data-test='stream-pov-label']").exists()).toBe(false);
    expect(wrapper.find("iframe").attributes("src")).toContain(
      "youtube.com/embed/abc123",
    );
  });
});

describe("StreamEmbed after the floating player closes", () => {
  async function floatKappa() {
    const wrapper = await mountEmbed([organizer, kappa]);
    await chipNamed(wrapper, "kappa POV").trigger("click");
    await settle();
    (wrapper.vm as any).setGlobalStream(kappa);
    await settle();
    return wrapper;
  }

  it("takes the POV back inline when the viewer closes it", async () => {
    const wrapper = await floatKappa();

    useApplicationSettingsStore().setGlobalStream();
    await settle();

    expect(wrapper.get("[data-test='stream-pov-label']").text()).toBe(
      "kappa POV",
    );
  });

  it("does not take back a POV the api stopped returning", async () => {
    const wrapper = await floatKappa();
    vi.stubGlobal(
      "$fetch",
      vi.fn(() => Promise.resolve({ streams: [] })),
    );
    const guard = effectScope();
    guard.run(() =>
      useTwitchPovGuard(
        () => useApplicationSettingsStore().globalStream as any,
        () => useApplicationSettingsStore().setGlobalStream(),
      ),
    );
    await settle();
    guard.stop();

    expect(useApplicationSettingsStore().globalStream).toBeNull();
    expect(wrapper.find("[data-test='stream-pov-label']").exists()).toBe(false);
    expect(wrapper.find("iframe").attributes("src")).toContain(
      "youtube.com/embed/abc123",
    );
  });
});
