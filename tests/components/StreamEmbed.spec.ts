import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamEmbed from "~/components/StreamEmbed.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import {
  embedStreamKey,
  useStoppedStreams,
} from "~/composables/useStoppedStreams";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
    },
  }),
}));

const youtube = {
  id: "s1",
  link: "https://www.youtube.com/watch?v=abc123",
  title: "Main feed",
  preview: true as const,
};

let unmount: (() => void) | undefined;

// The embed mounts its iframe a frame after the stream is picked.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flushPromises();
}

async function mountEmbed(
  props: Record<string, unknown> = {},
  streams: unknown[] = [youtube],
) {
  const wrapper = await mountSuspended(StreamEmbed, {
    props: { streams, ...props },
  });
  unmount = () => wrapper.unmount();
  await settle();
  return wrapper;
}

const buttonNamed = (wrapper: any, name: string) =>
  wrapper.findAll("button").find((b: any) => b.text() === name);

describe("StreamEmbed stop", () => {
  beforeEach(() => {
    useStoppedStreams().resume(embedStreamKey(youtube));
    useApplicationSettingsStore().setGlobalStream();
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it("removes the embed and shows the stopped bar", async () => {
    const wrapper = await mountEmbed({ started: true });
    expect(wrapper.find("iframe").exists()).toBe(true);

    await buttonNamed(wrapper, "Stop stream").trigger("click");

    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.text()).toContain("Stream stopped");
    expect(wrapper.text()).toContain("Main feed");
  });

  it("brings the embed back from Watch, without asking for play again", async () => {
    useStoppedStreams().stop(embedStreamKey(youtube));

    const wrapper = await mountEmbed();

    await buttonNamed(wrapper, "Watch").trigger("click");
    await settle();

    expect(wrapper.find("iframe").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Stream stopped");
  });

  it("starts stopped when the stream was stopped earlier", async () => {
    useStoppedStreams().stop(embedStreamKey(youtube));

    const wrapper = await mountEmbed();

    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.text()).toContain("Stream stopped");
  });

  it("has no Stop in the floating player", async () => {
    const wrapper = await mountEmbed({ global: true });

    expect(buttonNamed(wrapper, "Stop stream")).toBeUndefined();
  });
});

describe("StreamEmbed links", () => {
  beforeEach(() => {
    useApplicationSettingsStore().setGlobalStream();
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it.each(["javascript:void(0)", "data:text/html,<p>stream</p>"])(
    "never embeds %s",
    async (link) => {
      const wrapper = await mountEmbed({}, [
        { id: "s2", link, title: "Feed", preview: true },
      ]);

      expect(wrapper.find("iframe").exists()).toBe(false);
    },
  );

  it("sandboxes a self-hosted player so it can't navigate this tab", async () => {
    const wrapper = await mountEmbed({}, [
      {
        id: "s3",
        link: "https://stream.example.com/player",
        title: "Feed",
        preview: true,
      },
    ]);

    const iframe = wrapper.find("iframe");
    expect(iframe.attributes("src")).toBe("https://stream.example.com/player");
    const sandbox = iframe.attributes("sandbox")?.split(" ") ?? [];
    expect(sandbox).toEqual(
      expect.arrayContaining(["allow-scripts", "allow-same-origin"]),
    );
    expect(sandbox).not.toContain("allow-top-navigation");
    expect(sandbox).not.toContain("allow-forms");
  });
});

describe("StreamEmbed waits for play", () => {
  const twitch = {
    id: "w-twitch",
    link: "https://www.twitch.tv/northwind_cs",
    title: "Main broadcast",
    preview: true as const,
  };
  const youtubeFeed = {
    id: "w-youtube",
    link: "https://www.youtube.com/watch?v=yt42",
    title: "Co-stream",
    preview: true as const,
  };
  const kick = {
    id: "w-kick",
    link: "https://kick.com/eastside",
    title: "Kick feed",
    preview: true as const,
  };

  const twitchScript = () =>
    document.querySelector('script[src="https://player.twitch.tv/js/embed/v1.js"]');
  const playButton = (wrapper: any) =>
    wrapper.find("button[data-test='stream-press-play']");

  beforeEach(() => {
    useApplicationSettingsStore().setGlobalStream();
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    twitchScript()?.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    ["Twitch", twitch, "twitch.tv/northwind_cs"],
    ["YouTube", youtubeFeed, "youtube.com/watch?v=yt42"],
    ["Kick", kick, "kick.com/eastside"],
  ] as const)(
    "loads nothing from %s until play is pressed, and names the stream",
    async (platform, stream, channel) => {
      const wrapper = await mountEmbed({}, [{ ...stream, id: `idle-${stream.id}` }]);

      expect(wrapper.find("iframe").exists()).toBe(false);
      expect(twitchScript()).toBeNull();
      expect(playButton(wrapper).attributes("aria-label")).toBe(
        `Play ${stream.title}`,
      );
      expect(wrapper.text()).toContain(stream.title);
      expect(wrapper.text()).toContain(channel);
      expect(wrapper.text()).toContain(
        `Press play to load the ${platform} player. Nothing is loaded from ${platform} before that.`,
      );
      const open = wrapper
        .findAll("a")
        .find((link: any) => link.text() === `Open on ${platform}`);
      expect(open?.attributes("href")).toBe(stream.link);
      expect(open?.attributes("target")).toBe("_blank");
      expect(wrapper.find("button[aria-label='Unmute']").exists()).toBe(false);
    },
  );

  it("starts the Twitch player, muted, once play is pressed", async () => {
    const players: unknown[] = [];
    vi.stubGlobal("Twitch", {
      Player: class {
        constructor(_el: unknown, options: unknown) {
          players.push(options);
        }
        destroy() {}
        setMuted() {}
      },
    });
    const wrapper = await mountEmbed({}, [{ ...twitch, id: "press-twitch" }]);
    expect(players).toEqual([]);

    await playButton(wrapper).trigger("click");
    await settle();

    expect(players).toEqual([
      expect.objectContaining({
        channel: "northwind_cs",
        autoplay: true,
        muted: true,
      }),
    ]);
    expect(playButton(wrapper).exists()).toBe(false);
  });

  it("asks twitch.tv for its player script only on the press, and offers play again when it is blocked", async () => {
    const wrapper = await mountEmbed({}, [{ ...twitch, id: "blocked-twitch" }]);
    expect(twitchScript()).toBeNull();

    await playButton(wrapper).trigger("click");
    const script = twitchScript();
    expect(script).not.toBeNull();

    script!.dispatchEvent(new Event("error"));
    await settle();

    expect(playButton(wrapper).exists()).toBe(true);
    expect(wrapper.find("button[aria-label='Unmute']").exists()).toBe(false);
  });

  it("starts the stream muted when play is pressed", async () => {
    const wrapper = await mountEmbed({}, [youtubeFeed]);

    await playButton(wrapper).trigger("click");
    await settle();

    const src = wrapper.get("iframe").attributes("src");
    expect(src).toContain("youtube.com/embed/yt42");
    expect(src).toContain("mute=1");
    expect(wrapper.find("button[aria-label='Unmute']").exists()).toBe(true);
  });

  it("plays the next stream picked in the same card straight away", async () => {
    const first = { ...youtubeFeed, id: "pick-youtube" };
    const second = { ...kick, id: "pick-kick" };
    const wrapper = await mountEmbed({}, [first, second]);

    await playButton(wrapper).trigger("click");
    await settle();
    await buttonNamed(wrapper, "Kick feed").trigger("click");
    await settle();

    expect(playButton(wrapper).exists()).toBe(false);
    expect(wrapper.get("iframe").attributes("src")).toContain(
      "player.kick.com/eastside",
    );
  });

  it("keeps waiting when the viewer switches streams before pressing play", async () => {
    const first = { ...youtubeFeed, id: "idle-pick-youtube" };
    const second = { ...kick, id: "idle-pick-kick" };
    const wrapper = await mountEmbed({}, [first, second]);

    await buttonNamed(wrapper, "Kick feed").trigger("click");
    await settle();

    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(playButton(wrapper).attributes("aria-label")).toBe(
      "Play Kick feed",
    );
  });

  it("keeps a stream playing when it moves to the floating player", async () => {
    const stream = { ...youtubeFeed, id: "float-youtube" };
    const card = await mountEmbed({}, [stream]);
    await playButton(card).trigger("click");
    await settle();
    unmount?.();

    const floating = await mountEmbed({ global: true }, [stream]);

    expect(playButton(floating).exists()).toBe(false);
    expect(floating.get("iframe").attributes("src")).toContain(
      "youtube.com/embed/yt42",
    );
  });

  it("waits in the floating player for a stream nobody pressed play on", async () => {
    const wrapper = await mountEmbed({ global: true }, [
      { ...twitch, id: "float-idle-twitch" },
    ]);

    expect(playButton(wrapper).exists()).toBe(true);
    expect(twitchScript()).toBeNull();
  });

  it("tells its host once it has started, and plays straight away for a host that already did", async () => {
    const idle = await mountEmbed({ inline: true }, [
      { ...kick, id: "stage-kick" },
    ]);
    await playButton(idle).trigger("click");
    await settle();
    expect(idle.emitted("update:started")?.at(-1)).toEqual([true]);
    unmount?.();

    const next = await mountEmbed({ inline: true, started: true }, [
      { ...youtubeFeed, id: "stage-youtube" },
    ]);

    expect(playButton(next).exists()).toBe(false);
    expect(next.get("iframe").attributes("src")).toContain(
      "youtube.com/embed/yt42",
    );
  });

  it("still embeds a self-hosted player straight away", async () => {
    const wrapper = await mountEmbed({}, [
      {
        id: "w-self",
        link: "https://stream.example.com/player",
        title: "Feed",
        preview: true,
      },
    ]);

    expect(playButton(wrapper).exists()).toBe(false);
    expect(wrapper.get("iframe").attributes("src")).toBe(
      "https://stream.example.com/player",
    );
  });
});
