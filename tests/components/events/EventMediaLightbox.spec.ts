import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventMediaLightbox from "~/components/events/EventMediaLightbox.vue";

const event = { id: "event-1" };

const image = (id: string) => ({
  id,
  filename: `${id}.png`,
  mime_type: "image/png",
  title: `Shot ${id}`,
});

const video = (id: string) => ({
  id,
  filename: `${id}.mp4`,
  mime_type: "video/mp4",
  thumbnail_filename: `${id}.jpg`,
});

const audio = (id: string) => ({
  id,
  filename: `${id}.mp3`,
  mime_type: "audio/mpeg",
});

const link = (id: string) => ({
  id,
  external_url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
});

const items = [image("a"), audio("b"), link("c"), video("d"), image("e")];

let mounted: VueWrapper | null = null;

async function mountAt(mediaId: string) {
  const wrapper = await mountSuspended(EventMediaLightbox, {
    props: {
      event,
      items,
      mediaId,
      "onUpdate:mediaId": (value: string | null) =>
        wrapper.setProps({ mediaId: value }),
    },
    attachTo: document.body,
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("EventMediaLightbox", () => {
  // The dialog teleports to <body>, so a failed test must not leave it there.
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("steps with the arrow keys, skipping audio and links", async () => {
    const wrapper = await mountAt("a");

    expect(document.body.querySelector("img")?.getAttribute("src")).toMatch(
      /\/events\/media\/event-1\/a\.png$/,
    );

    press("ArrowRight");
    await flushPromises();
    expect(wrapper.emitted("update:mediaId")?.at(-1)).toEqual(["d"]);
    expect(document.body.querySelector("video")?.getAttribute("src")).toMatch(
      /\/events\/media\/event-1\/d\.mp4$/,
    );

    press("ArrowRight");
    await flushPromises();
    expect(wrapper.emitted("update:mediaId")?.at(-1)).toEqual(["e"]);

    press("ArrowLeft");
    await flushPromises();
    expect(wrapper.emitted("update:mediaId")?.at(-1)).toEqual(["d"]);
  });

  it("stops at either end of the gallery", async () => {
    const wrapper = await mountAt("a");

    expect(document.body.querySelector("[data-lightbox-previous]")).toBeNull();
    press("ArrowLeft");
    await flushPromises();
    expect(wrapper.emitted("update:mediaId")).toBeUndefined();

    await wrapper.setProps({ mediaId: "e" });
    await flushPromises();
    expect(document.body.querySelector("[data-lightbox-next]")).toBeNull();
    press("ArrowRight");
    await flushPromises();
    expect(wrapper.emitted("update:mediaId")).toBeUndefined();
  });

  it("steps with the edge buttons", async () => {
    const wrapper = await mountAt("d");

    (
      document.body.querySelector("[data-lightbox-previous]") as HTMLElement
    ).click();
    await flushPromises();
    expect(wrapper.emitted("update:mediaId")?.at(-1)).toEqual(["a"]);
  });
});
