import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventHero from "~/components/events/EventHero.vue";

function event(banner: { filename: string; mime_type: string }) {
  return {
    id: "event-1",
    name: "Spring Invitational",
    starts_at: new Date(Date.now() + 86_400_000).toISOString(),
    ends_at: null,
    visibility: "Public",
    banner: { id: "media-1", ...banner },
    organizers: [],
  };
}

describe("EventHero banner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lazy-loads a banner image", async () => {
    const wrapper = await mountSuspended(EventHero, {
      props: { event: event({ filename: "b.png", mime_type: "image/png" }) },
    });

    expect(wrapper.find("img").attributes("loading")).toBe("lazy");
  });

  it("only downloads and plays a banner video once it is on screen", async () => {
    let onIntersect: (
      entries: Partial<IntersectionObserverEntry>[],
    ) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof onIntersect) {
          onIntersect = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});

    const wrapper = await mountSuspended(EventHero, {
      props: { event: event({ filename: "b.mp4", mime_type: "video/mp4" }) },
    });
    const video = wrapper.find("video");

    expect(video.attributes("preload")).toBe("none");
    expect(video.attributes()).not.toHaveProperty("autoplay");
    expect(play).not.toHaveBeenCalled();

    onIntersect([{ isIntersecting: true }]);
    expect(play).toHaveBeenCalledTimes(1);

    onIntersect([{ isIntersecting: false }]);
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
