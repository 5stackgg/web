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

// Closing the floating player on the stream's own match page.
const stopEmbed = async (stream: any) => {
  useStoppedStreams().stop(embedStreamKey(stream));
  await settle();
};

describe("StreamEmbed stop", () => {
  beforeEach(() => {
    useStoppedStreams().resume(embedStreamKey(youtube));
    useApplicationSettingsStore().setGlobalStream();
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it("removes the embed and shows the stopped bar once stopped", async () => {
    const wrapper = await mountEmbed({ started: true });
    expect(wrapper.find("iframe").exists()).toBe(true);

    await stopEmbed(youtube);

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

  it("puts the move to the floating player in the corner bar, and no Stop over the stream", async () => {
    const wrapper = await mountEmbed();
    const labels = wrapper
      .find(".stream-controls")
      .findAll("button")
      .map((b: any) => b.attributes("aria-label"));

    expect(labels).toContain("Move to global view");
    expect(labels.filter((label: string) => /stop/i.test(label))).toEqual([]);
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
    document.querySelector(
      'script[src="https://player.twitch.tv/js/embed/v1.js"]',
    );
  const playButton = (wrapper: any) =>
    wrapper.find("button[data-test='stream-press-play']");
  const isTwitchScript = (node: unknown): node is HTMLScriptElement =>
    node instanceof HTMLScriptElement &&
    node.src === "https://player.twitch.tv/js/embed/v1.js";
  // The test DOM fails an external script the moment it goes in, and a failed
  // script is taken out of the page, so each one is caught as it goes in.
  const watchTwitchScripts = () => {
    const appended = vi.spyOn(document.body, "appendChild");
    return () =>
      appended.mock.calls.map(([node]) => node).filter(isTwitchScript);
  };
  // Kept out of the page, so the test decides how it ends.
  const holdTwitchScripts = () => {
    const append = document.body.appendChild.bind(document.body);
    const held: HTMLScriptElement[] = [];
    vi.spyOn(document.body, "appendChild").mockImplementation(
      <T extends Node>(node: T) => {
        if (isTwitchScript(node)) {
          held.push(node);
          return node;
        }
        return append(node);
      },
    );
    return held;
  };
  const countTwitchPlayers = () => {
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
    return players;
  };

  beforeEach(() => {
    useApplicationSettingsStore().setGlobalStream();
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    twitchScript()?.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["Twitch", twitch, "twitch.tv/northwind_cs"],
    ["YouTube", youtubeFeed, "youtube.com/watch?v=yt42"],
    ["Kick", kick, "kick.com/eastside"],
  ] as const)(
    "loads nothing from %s until play is pressed, and names the stream",
    async (platform, stream, channel) => {
      const wrapper = await mountEmbed({}, [
        { ...stream, id: `idle-${stream.id}` },
      ]);

      expect(wrapper.find("iframe").exists()).toBe(false);
      expect(twitchScript()).toBeNull();
      expect(playButton(wrapper).attributes("aria-label")).toBe(
        `Play ${stream.title}`,
      );
      expect(wrapper.text()).toContain(stream.title);
      expect(wrapper.text()).toContain(channel);
      const notice = `Press play to load the ${platform} player.`;
      expect(wrapper.text()).toContain(notice);
      expect(wrapper.text()).not.toContain("Nothing is loaded");
      const describedBy = playButton(wrapper).attributes("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(wrapper.get(`[id="${describedBy}"]`).text()).toBe(notice);
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

  it("keeps the viewer's own Twitch volume when they unmute", async () => {
    const volumes: number[] = [];
    vi.stubGlobal("Twitch", {
      Player: class {
        destroy() {}
        setMuted() {}
        getVolume() {
          return 0.2;
        }
        setVolume(volume: number) {
          volumes.push(volume);
        }
      },
    });
    const wrapper = await mountEmbed({}, [{ ...twitch, id: "volume-twitch" }]);
    await playButton(wrapper).trigger("click");
    await settle();

    await wrapper.find("button[aria-label='Unmute']").trigger("click");

    expect(volumes).toEqual([]);
    expect(
      (wrapper.find("input[type='range']").element as HTMLInputElement).value,
    ).toBe("0.2");
  });

  it("asks twitch.tv for its player script only on the press, and offers play again when it is blocked", async () => {
    const scripts = watchTwitchScripts();
    const wrapper = await mountEmbed({}, [
      { ...twitch, id: "blocked-twitch" },
    ]);
    expect(scripts()).toHaveLength(0);

    await playButton(wrapper).trigger("click");
    await settle();

    expect(scripts()).toHaveLength(1);
    expect(playButton(wrapper).exists()).toBe(true);
    expect(wrapper.find("button[aria-label='Unmute']").exists()).toBe(false);
  });

  it("asks for Twitch's player script again on a retry after it was blocked", async () => {
    const scripts = watchTwitchScripts();
    const wrapper = await mountEmbed({}, [{ ...twitch, id: "retry-twitch" }]);

    await playButton(wrapper).trigger("click");
    await settle();

    expect(twitchScript()).toBeNull();
    expect(playButton(wrapper).exists()).toBe(true);

    await playButton(wrapper).trigger("click");
    await settle();

    expect(scripts()).toHaveLength(2);
    expect(scripts()[1]).not.toBe(scripts()[0]);
    expect(playButton(wrapper).exists()).toBe(true);
  });

  it("treats a Twitch script that loads without its player as blocked", async () => {
    const held = holdTwitchScripts();
    const wrapper = await mountEmbed({}, [
      { ...twitch, id: "hollow-twitch" },
    ]);

    await playButton(wrapper).trigger("click");
    held[0].dispatchEvent(new Event("load"));
    await settle();

    expect(playButton(wrapper).exists()).toBe(true);

    await playButton(wrapper).trigger("click");
    await settle();

    expect(held).toHaveLength(2);
    held[1].dispatchEvent(new Event("error"));
    await settle();
  });

  it("plays on a retry once Twitch's player is reachable again", async () => {
    const wrapper = await mountEmbed({}, [
      { ...twitch, id: "retry-ok-twitch" },
    ]);
    await playButton(wrapper).trigger("click");
    await settle();
    expect(playButton(wrapper).exists()).toBe(true);

    const players = countTwitchPlayers();
    await playButton(wrapper).trigger("click");
    await settle();

    expect(players).toHaveLength(1);
    expect(playButton(wrapper).exists()).toBe(false);
  });

  it("starts another card on the same stream once play is pressed in one", async () => {
    const stream = { ...youtubeFeed, id: "twice-youtube" };
    const first = await mountSuspended(StreamEmbed, {
      props: { streams: [stream] },
    });
    const second = await mountSuspended(StreamEmbed, {
      props: { streams: [stream] },
    });
    await settle();

    await playButton(first).trigger("click");
    await settle();

    expect(playButton(second).exists()).toBe(false);
    expect(second.get("iframe").attributes("src")).toContain(
      "youtube.com/embed/yt42",
    );
    first.unmount();
    second.unmount();
  });

  it("brings a second card on the same stream back when Watch is pressed in the first", async () => {
    const stream = { ...youtubeFeed, id: "twice-stopped-youtube" };
    const first = await mountSuspended(StreamEmbed, {
      props: { streams: [stream] },
    });
    const second = await mountSuspended(StreamEmbed, {
      props: { streams: [stream] },
    });
    await settle();
    await playButton(first).trigger("click");
    await settle();

    await stopEmbed(stream);
    expect(second.text()).toContain("Stream stopped");

    await buttonNamed(first, "Watch").trigger("click");
    await settle();

    expect(second.get("iframe").attributes("src")).toContain(
      "youtube.com/embed/yt42",
    );
    first.unmount();
    second.unmount();
  });

  it("builds one Twitch player when a stream stopped before play is watched", async () => {
    const players = countTwitchPlayers();
    const stream = { ...twitch, id: "stopped-waiting-twitch" };
    const wrapper = await mountEmbed({}, [stream]);

    await stopEmbed(stream);
    await buttonNamed(wrapper, "Watch").trigger("click");
    await settle();

    expect(players).toHaveLength(1);
  });

  it("retries every card on a blocked Twitch stream once one of them gets through", async () => {
    const stream = { ...twitch, id: "shared-blocked-twitch" };
    const first = await mountSuspended(StreamEmbed, {
      props: { streams: [stream] },
    });
    const second = await mountSuspended(StreamEmbed, {
      props: { streams: [stream] },
    });
    await settle();
    await playButton(first).trigger("click");
    await settle();
    expect(playButton(first).exists()).toBe(true);
    expect(playButton(second).exists()).toBe(true);

    const players = countTwitchPlayers();
    await playButton(first).trigger("click");
    await settle();

    expect(playButton(second).exists()).toBe(false);
    expect(players).toHaveLength(2);
    first.unmount();
    second.unmount();
  });

  it("hands focus to the player when play is pressed", async () => {
    const wrapper = await mountSuspended(StreamEmbed, {
      props: { streams: [{ ...kick, id: "focus-kick" }] },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();
    await settle();

    const player = wrapper.get("[data-test='stream-player']")
      .element as HTMLElement;
    const focus = vi.spyOn(player, "focus");
    const play = playButton(wrapper);
    (play.element as HTMLElement).focus();
    await play.trigger("click");
    await settle();

    expect(document.activeElement).toBe(player);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("keeps the placeholder's text above the /watch stage's match card", async () => {
    const wrapper = await mountEmbed({ inline: true }, [
      { ...kick, id: "stage-layout-kick" },
    ]);

    expect(playButton(wrapper).classes()).toContain("pb-[18%]");
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
