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

  it("plays each clip from its own URL, so whatever serves it counts the view", async () => {
    await openOn("c-1");
    expect(playerVideo()!.getAttribute("src")).toBe(clip("c-1").download_url);

    await playTo(15);
    await wrapper!.setProps({ clipId: "c-2" });
    await flushPromises();

    expect(playerVideo()!.getAttribute("src")).toBe(clip("c-2").download_url);
    expect(preloadVideo()).toBeNull();
  });

  it("sends no view of its own on top of the player's request", async () => {
    await openOn("c-1");
    await playTo(12);
    await playTo(19);

    expect(beacon).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
