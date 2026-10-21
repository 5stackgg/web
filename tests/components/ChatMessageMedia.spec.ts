import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessageMedia from "~/components/chat/ChatMessageMedia.vue";
import ChatMessage from "~/components/chat/ChatMessage.vue";

const image = (id: string, width = 640, height = 360) => ({
  id,
  kind: "image",
  name: `${id}.png`,
  mime_type: "image/png",
  size: 2048,
  width,
  height,
});

const video = (id: string, poster = true) => ({
  id,
  kind: "video",
  name: "retake-a.mp4",
  mime_type: "video/mp4",
  size: 4096,
  width: 1920,
  height: 1080,
  duration_ms: 14_000,
  poster,
});

const message = (overrides: Record<string, unknown> = {}) => ({
  id: "m-1",
  message: "",
  source: "web",
  timestamp: new Date().toISOString(),
  from: { steam_id: "76561198000000001", name: "kairo" },
  ...overrides,
});

const reduceMotion = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));

describe("ChatMessageMedia", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lays several images out in a grid", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: {
        message: message({
          attachments: [image("0b7d6c1e-1111-4a2b-9c3d-00000000000a"), image("0b7d6c1e-1111-4a2b-9c3d-00000000000b"), image("0b7d6c1e-1111-4a2b-9c3d-00000000000c")],
        }),
      },
    });

    const tiles = wrapper.findAll("[data-attachment-id]");

    expect(tiles.map((tile) => tile.attributes("data-attachment-id"))).toEqual(
      ["0b7d6c1e-1111-4a2b-9c3d-00000000000a", "0b7d6c1e-1111-4a2b-9c3d-00000000000b", "0b7d6c1e-1111-4a2b-9c3d-00000000000c"],
    );
    expect(wrapper.find("[data-chat-image-grid]").classes()).toContain(
      "grid-cols-2",
    );
  });

  it("keeps a lone image's own shape, before it has even loaded", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: { message: message({ attachments: [image("0b7d6c1e-1111-4a2b-9c3d-00000000000a", 800, 400)] }) },
    });

    expect(
      wrapper.get("[data-attachment-id='0b7d6c1e-1111-4a2b-9c3d-00000000000a']").attributes("style"),
    ).toContain("aspect-ratio: 800 / 400");
  });

  it("shows a video by its poster, with its name and length", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: { message: message({ attachments: [video("0b7d6c1e-1111-4a2b-9c3d-00000000000d")] }) },
    });

    const tile = wrapper.get("[data-attachment-id='0b7d6c1e-1111-4a2b-9c3d-00000000000d']");

    expect(tile.text()).toContain("retake-a.mp4");
    expect(tile.text()).toContain("0:14");
    expect(tile.find("[data-video-poster]").attributes("data-src")).toMatch(
      /\/chat\/attachments\/0b7d6c1e-1111-4a2b-9c3d-00000000000d\/poster$/,
    );
  });

  it("opens a video in the lightbox to play it", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: { message: message({ attachments: [video("0b7d6c1e-1111-4a2b-9c3d-00000000000d", false)] }) },
      attachTo: document.body,
    });

    await wrapper.get("[data-attachment-id='0b7d6c1e-1111-4a2b-9c3d-00000000000d']").trigger("click");
    await flushPromises();

    expect(document.body.querySelector("video")?.getAttribute("src")).toMatch(
      /\/chat\/attachments\/0b7d6c1e-1111-4a2b-9c3d-00000000000d$/,
    );

    wrapper.unmount();
  });

  // Scaling a small image up to fill the box only blurs it.
  it("never shows a small image bigger than it is", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: { message: message({ attachments: [image("0b7d6c1e-1111-4a2b-9c3d-00000000000a", 120, 80)] }) },
    });

    expect(
      wrapper.get("[data-attachment-id='0b7d6c1e-1111-4a2b-9c3d-00000000000a']").attributes("style"),
    ).toContain("max-width: 120px");
  });

  it("shows a GIF's still frame to anyone who asked for less motion", async () => {
    reduceMotion();

    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: {
        message: message({ gif: { id: "abc123", width: 480, height: 270 } }),
      },
    });

    expect(
      wrapper.get("[data-gif-id='abc123'] img").attributes("src"),
    ).toBe("https://i.giphy.com/media/abc123/giphy_s.gif");
  });

  it("lets a player who asked for less motion tap a still GIF to play it, and pause it again", async () => {
    reduceMotion();

    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: {
        message: message({ gif: { id: "abc123", width: 480, height: 270 } }),
      },
    });

    const gif = wrapper.get("[data-gif-id='abc123']");
    const play = gif.get("button[data-gif-play]");

    expect(play.attributes("aria-label")).toBe("Play GIF");
    expect(play.attributes("aria-pressed")).toBe("false");
    expect(play.classes()).toContain("inset-0");
    expect(gif.find("[data-gif-animated]").exists()).toBe(false);

    await play.trigger("click");

    expect(play.attributes("aria-pressed")).toBe("true");
    expect(play.classes()).not.toContain("inset-0");
    expect(play.classes()).toEqual(
      expect.arrayContaining(["bottom-1.5", "right-1.5"]),
    );
    expect(play.find("[data-gif-pause-icon]").exists()).toBe(true);
    expect(gif.get("[data-gif-animated] img").attributes("src")).toBe(
      "https://i.giphy.com/media/abc123/giphy.webp",
    );
    expect(gif.get("img").attributes("src")).toBe(
      "https://i.giphy.com/media/abc123/giphy_s.gif",
    );

    await play.trigger("click");

    expect(play.attributes("aria-pressed")).toBe("false");
    expect(play.classes()).toContain("inset-0");
    expect(gif.find("[data-gif-animated]").exists()).toBe(false);
    expect(gif.get("img").attributes("src")).toBe(
      "https://i.giphy.com/media/abc123/giphy_s.gif",
    );
  });

  it("puts no buttons on a GIF for anyone who has not asked for less motion", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: {
        message: message({ gif: { id: "abc123", width: 480, height: 270 } }),
      },
    });

    const gif = wrapper.get("[data-gif-id='abc123']");

    expect(gif.find("button").exists()).toBe(false);
    expect(gif.get("img").attributes("src")).toBe(
      "https://i.giphy.com/media/abc123/giphy.webp",
    );
  });

  it("plays a GIF inline, from GIPHY", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: {
        message: message({ gif: { id: "abc123", width: 480, height: 270 } }),
      },
    });

    const gif = wrapper.get("[data-gif-id='abc123']");

    expect(gif.text()).toContain("GIF");
    expect(gif.attributes("style")).toContain("aspect-ratio: 480 / 270");
    expect(gif.attributes("style")).toContain("max-width: 480px");
  });

  it("holds a tall GIF to the same height as a tall image", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: {
        message: message({ gif: { id: "abc123", width: 270, height: 480 } }),
      },
    });

    expect(wrapper.get("[data-gif-id='abc123']").attributes("style")).toContain(
      "max-width: 169px",
    );
  });
});

describe("ChatMessage with media", () => {
  it("leaves out the text line when only files were sent", async () => {
    const wrapper = await mountSuspended(ChatMessage, {
      props: { message: message({ attachments: [image("0b7d6c1e-1111-4a2b-9c3d-00000000000a")] }) },
    });

    expect(wrapper.find("p").exists()).toBe(false);
    expect(wrapper.find("[data-attachment-id='0b7d6c1e-1111-4a2b-9c3d-00000000000a']").exists()).toBe(true);
  });

  it("shows text and files together", async () => {
    const wrapper = await mountSuspended(ChatMessage, {
      props: {
        message: message({ message: "our smokes for B", attachments: [image("0b7d6c1e-1111-4a2b-9c3d-00000000000a")] }),
      },
    });

    expect(wrapper.text()).toContain("our smokes for B");
    expect(wrapper.find("[data-attachment-id='0b7d6c1e-1111-4a2b-9c3d-00000000000a']").exists()).toBe(true);
  });

  it("runs media under the avatar, with the time under the name when only the name is above", async () => {
    const gif = { id: "abc123", width: 480, height: 270 };
    const gifOnly = await mountSuspended(ChatMessage, {
      props: { message: message({ gif }) },
    });
    const withText = await mountSuspended(ChatMessage, {
      props: { message: message({ message: "gg", gif }) },
    });

    expect(gifOnly.get("[data-chat-media]").classes()).toEqual(
      expect.arrayContaining(["-ml-10", "pt-1"]),
    );
    expect(gifOnly.find("[data-chat-media-time]").exists()).toBe(true);
    expect(withText.get("[data-chat-media]").classes()).toContain("-ml-10");
    expect(withText.get("[data-chat-media]").classes()).not.toContain("pt-1");
    expect(withText.find("[data-chat-media-time]").exists()).toBe(false);
  });

  it("drops the hover time from a grouped line that opens on media", async () => {
    const previousMessage = message({ id: "m-0", message: "first" });
    const gifLine = await mountSuspended(ChatMessage, {
      props: {
        previousMessage,
        message: message({ gif: { id: "abc123", width: 480, height: 270 } }),
      },
    });
    const textLine = await mountSuspended(ChatMessage, {
      props: { previousMessage, message: message({ message: "second" }) },
    });

    expect(gifLine.find("[data-chat-clock]").exists()).toBe(false);
    expect(gifLine.find("[data-chat-media]").classes()).not.toContain("pt-1");
    expect(textLine.find("[data-chat-clock]").exists()).toBe(true);
  });
});
