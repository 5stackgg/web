import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ClipDetailModal from "~/components/clips/ClipDetailModal.vue";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";
import { useClipModal } from "~/composables/useClipModal";

const { observers } = vi.hoisted(() => ({
  observers: {} as Record<string, { next: (result: any) => void }>,
}));

function clip(id: string) {
  return {
    id,
    user_steam_id: "1",
    target_steam_id: "1",
    match_map_id: "mm-1",
    title: `Clip ${id}`,
    duration_ms: 20000,
    download_url: `https://cf.test/clips/1/${id}.mp4?name=${id}.mp4&v=1`,
    thumbnail_url: null,
    thumbnail_download_url: null,
    kills_count: 3,
    round: 8,
    views_count: 4,
    visibility: "public",
    created_at: "2026-10-07T10:00:00Z",
    user: { steam_id: "1", name: "rawr", avatar_url: null },
    target: { steam_id: "1", name: "rawr", avatar_url: null },
    match_map: null,
  };
}

const idIn = (query: any) =>
  String(query.loc?.source.body ?? "").match(/"(c-\d+)"/)?.[1];

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: async ({ query }: any) => {
      const id = idIn(query);
      return { data: { player_kills: [], match_clips: id ? [clip(id)] : [] } };
    },
    subscribe: ({ query }: any) => ({
      subscribe: (observer: any) => {
        const id = idIn(query);
        if (id) {
          observers[id] = observer;
        }
        return { unsubscribe() {} };
      },
    }),
  }),
}));

const auth = reactive({
  me: { steam_id: "9", role: "user" } as any,
  isAdmin: false,
  isRoleAbove: () => false,
});
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const clipModal = () => useNuxtApp().runWithContext(() => useClipModal());

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | null = null;
let beacon: ReturnType<typeof vi.fn>;

beforeEach(() => {
  beacon = vi.fn(() => true);
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: beacon,
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 200 }),
  );
  const modal = clipModal();
  modal.setClipQueue(
    ["c-1", "c-2", "c-3"].map((id) => ({
      id,
      title: `Clip ${id}`,
      playerName: "rawr",
      teamName: null,
      durationMs: 20000,
      thumbnailUrl: null,
      posterUrl: null,
    })),
  );
  modal.showClip("c-1");
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  Object.keys(observers).forEach((id) => delete observers[id]);
  clipModal().clearClipQueue();
  clipModal().closeClip();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function openOn(id: string) {
  wrapper = await mountSuspended(ClipDetailModal, {
    props: { clipId: id },
    attachTo: document.body,
  });
  await flushPromises();
  observers[id].next({ data: { match_clips: [clip(id)] } });
  await flushPromises();
}

async function playTo(seconds: number, duration = 20) {
  wrapper!.findComponent(ClipPlayer).vm.$emit("progress", {
    progress: seconds / duration,
    currentTime: seconds,
    duration,
  });
  await flushPromises();
}

const playerVideo = () =>
  document.querySelector<HTMLVideoElement>("video:not([data-preload])");
const preloadVideo = () =>
  document.querySelector<HTMLVideoElement>("video[data-preload]");

describe("ClipDetailModal view counting", () => {
  it("never lets warming the next clip count as a view of it", async () => {
    await openOn("c-1");
    await playTo(15);

    const preload = new URL(preloadVideo()!.getAttribute("src")!);
    expect(preload.pathname).toBe("/clips/1/c-2.mp4");
    expect(preload.searchParams.get("noview")).toBe("1");
  });

  it("plays from the very URL it warmed, so the switch is served from cache", async () => {
    await openOn("c-1");
    await playTo(15);
    const warmed = preloadVideo()!.getAttribute("src");

    await wrapper!.setProps({ clipId: "c-2" });
    await flushPromises();

    expect(playerVideo()!.getAttribute("src")).toBe(warmed);
  });

  it("counts a clip once its playback passes the midpoint", async () => {
    await openOn("c-1");

    await playTo(9);
    expect(beacon).not.toHaveBeenCalled();

    await playTo(10.5);
    await playTo(14);

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon).toHaveBeenCalledWith(clip("c-1").download_url);
  });

  it("does not count a clip skipped before its midpoint, nor the one it was warming", async () => {
    await openOn("c-1");
    await playTo(15);
    await playTo(9);

    await wrapper!.setProps({ clipId: "c-2" });
    await flushPromises();
    observers["c-2"].next({ data: { match_clips: [clip("c-2")] } });
    await flushPromises();
    await playTo(2);

    expect(beacon.mock.calls.map(([url]) => url)).toEqual([
      clip("c-1").download_url,
    ]);
  });

  it("counts the next clip on its own once it is watched", async () => {
    await openOn("c-1");
    await playTo(12);

    await wrapper!.setProps({ clipId: "c-2" });
    await flushPromises();
    observers["c-2"].next({ data: { match_clips: [clip("c-2")] } });
    await flushPromises();
    await playTo(11);

    expect(beacon.mock.calls.map(([url]) => url)).toEqual([
      clip("c-1").download_url,
      clip("c-2").download_url,
    ]);
  });

  it("counts a clip watched again after the viewer closed and reopened it", async () => {
    await openOn("c-1");
    await playTo(12);

    await wrapper!.setProps({ clipId: null });
    await flushPromises();
    await wrapper!.setProps({ clipId: "c-1" });
    await flushPromises();
    observers["c-1"].next({ data: { match_clips: [clip("c-1")] } });
    await flushPromises();
    await playTo(12);

    expect(beacon).toHaveBeenCalledTimes(2);
  });

  it("falls back to a keepalive request where beacons are refused", async () => {
    beacon.mockReturnValue(false);
    await openOn("c-1");
    await playTo(12);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      clip("c-1").download_url,
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });
});
