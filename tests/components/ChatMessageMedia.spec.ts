import { describe, expect, it } from "vitest";
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

describe("ChatMessageMedia", () => {
  it("lays several images out in a grid", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: {
        message: message({
          attachments: [image("a-1"), image("a-2"), image("a-3")],
        }),
      },
    });

    const tiles = wrapper.findAll("[data-attachment-id]");

    expect(tiles.map((tile) => tile.attributes("data-attachment-id"))).toEqual(
      ["a-1", "a-2", "a-3"],
    );
    expect(wrapper.find("[data-chat-image-grid]").classes()).toContain(
      "grid-cols-2",
    );
  });

  it("keeps a lone image's own shape, before it has even loaded", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: { message: message({ attachments: [image("a-1", 800, 400)] }) },
    });

    expect(
      wrapper.get("[data-attachment-id='a-1']").attributes("style"),
    ).toContain("aspect-ratio: 800 / 400");
  });

  it("shows a video by its poster, with its name and length", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: { message: message({ attachments: [video("v-1")] }) },
    });

    const tile = wrapper.get("[data-attachment-id='v-1']");

    expect(tile.text()).toContain("retake-a.mp4");
    expect(tile.text()).toContain("0:14");
    expect(tile.find("[data-video-poster]").attributes("data-src")).toMatch(
      /\/chat\/attachments\/v-1\/poster$/,
    );
  });

  it("opens a video in the lightbox to play it", async () => {
    const wrapper = await mountSuspended(ChatMessageMedia, {
      props: { message: message({ attachments: [video("v-1", false)] }) },
      attachTo: document.body,
    });

    await wrapper.get("[data-attachment-id='v-1']").trigger("click");
    await flushPromises();

    expect(document.body.querySelector("video")?.getAttribute("src")).toMatch(
      /\/chat\/attachments\/v-1$/,
    );

    wrapper.unmount();
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
  });
});

describe("ChatMessage with media", () => {
  it("leaves out the text line when only files were sent", async () => {
    const wrapper = await mountSuspended(ChatMessage, {
      props: { message: message({ attachments: [image("a-1")] }) },
    });

    expect(wrapper.find("p").exists()).toBe(false);
    expect(wrapper.find("[data-attachment-id='a-1']").exists()).toBe(true);
  });

  it("shows text and files together", async () => {
    const wrapper = await mountSuspended(ChatMessage, {
      props: {
        message: message({ message: "our smokes for B", attachments: [image("a-1")] }),
      },
    });

    expect(wrapper.text()).toContain("our smokes for B");
    expect(wrapper.find("[data-attachment-id='a-1']").exists()).toBe(true);
  });
});
