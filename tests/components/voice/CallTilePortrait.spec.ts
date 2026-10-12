import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import CallTile from "~/components/voice/CallTile.vue";

const participant = {
  steamId: "76561198000000002",
  name: "sable",
  avatarUrl: null,
  connected: true,
  speaking: false,
  coach: false,
} as any;

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | null = null;

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

async function mountTile(props: Record<string, unknown> = {}) {
  wrapper = await mountSuspended(CallTile, {
    props: {
      participant,
      stream: new MediaStream(),
      isMe: false,
      ...props,
    },
  });
  await flushPromises();
  return wrapper;
}

async function frame(width: number, height: number, event: string) {
  const video = wrapper!.find("video").element as HTMLVideoElement;
  Object.defineProperty(video, "videoWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(video, "videoHeight", {
    configurable: true,
    value: height,
  });
  video.dispatchEvent(new Event(event));
  await flushPromises();
}

const videoClasses = () => wrapper!.find("video").classes();

describe("CallTile video fit", () => {
  it("fits a portrait phone feed whole instead of cropping it", async () => {
    await mountTile();
    await frame(480, 854, "loadedmetadata");

    expect(videoClasses()).toContain("object-contain");
    expect(videoClasses()).not.toContain("object-cover");
  });

  it("keeps filling the tile with a landscape feed", async () => {
    await mountTile();
    await frame(640, 360, "loadedmetadata");

    expect(videoClasses()).toContain("object-cover");
    expect(videoClasses()).not.toContain("object-contain");
  });

  it("goes back to filling the tile when the phone is turned sideways mid-call", async () => {
    await mountTile();
    await frame(480, 854, "loadedmetadata");
    await frame(854, 480, "resize");

    expect(videoClasses()).toContain("object-cover");

    await frame(480, 854, "resize");

    expect(videoClasses()).toContain("object-contain");
  });

  it("treats a square feed as filling the tile", async () => {
    await mountTile();
    await frame(480, 480, "loadedmetadata");

    expect(videoClasses()).toContain("object-cover");
  });

  it("fits your own mirrored portrait tile the same way", async () => {
    await mountTile({ isMe: true, mirrored: true, compact: true });
    await frame(480, 854, "loadedmetadata");

    expect(videoClasses()).toContain("object-contain");
    expect(videoClasses()).toContain("-scale-x-100");
  });

  it("forgets the last feed's shape when the stream is swapped", async () => {
    await mountTile();
    await frame(480, 854, "loadedmetadata");

    const video = wrapper!.find("video").element as HTMLVideoElement;
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 0 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 0 });
    await wrapper!.setProps({
      stream: new MediaStream(),
    });
    await flushPromises();

    expect(videoClasses()).toContain("object-cover");
  });
});
