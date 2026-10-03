import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventMediaTile from "~/components/events/EventMediaTile.vue";

const event = { id: "event-1" };

describe("EventMediaTile", () => {
  it("opens a video in the lightbox instead of playing it inline", async () => {
    const wrapper = await mountSuspended(EventMediaTile, {
      props: {
        event,
        item: {
          id: "v",
          filename: "v.mp4",
          mime_type: "video/mp4",
          thumbnail_filename: "v.jpg",
        },
      },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("view")).toEqual([["v"]]);
    expect(wrapper.find("video").exists()).toBe(false);
  });

  it("opens an image in the lightbox", async () => {
    const wrapper = await mountSuspended(EventMediaTile, {
      props: {
        event,
        item: { id: "i", filename: "i.png", mime_type: "image/png" },
      },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("view")).toEqual([["i"]]);
  });
});
