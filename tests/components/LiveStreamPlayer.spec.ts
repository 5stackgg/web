import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import LiveStreamPlayer from "~/components/match/LiveStreamPlayer.vue";
import { useAuthStore } from "~/stores/AuthStore";

const { subscriptions } = vi.hoisted(() => ({
  subscriptions: [] as Array<{ query: string; next: (result: any) => void }>,
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: (options: any) => ({
        subscribe: ({ next }: { next: (result: any) => void }) => {
          subscriptions.push({ query: print(options.query), next });
          return { unsubscribe() {} };
        },
      }),
    },
  }),
}));

const streamRow = {
  id: "stream-1",
  match_id: "match-1",
  title: "Live",
  link: "https://stream.example/match-1/",
  is_live: true,
  mode: "tv",
  status: "live",
};

async function pushStream(row: typeof streamRow | null) {
  for (const subscription of subscriptions) {
    if (subscription.query.includes("match_streams")) {
      subscription.next({ data: { match_streams: row ? [row] : [] } });
    }
  }
  await flushPromises();
}

async function mountPlayer() {
  return mountSuspended(LiveStreamPlayer, {
    props: { matchId: "match-1", inGlobal: true },
    global: {
      stubs: {
        StreamCanvas: { template: '<div class="stream-canvas"><slot /></div>' },
        MatchScoreboardOverlay: true,
        StreamViewerBadge: true,
      },
    },
  });
}

describe("LiveStreamPlayer", () => {
  beforeEach(() => {
    subscriptions.length = 0;
    useAuthStore().me = { steam_id: "76561198000000001", role: "user" } as any;
  });

  it("plays while the stream is running", async () => {
    const wrapper = await mountPlayer();
    await pushStream(streamRow);

    expect(wrapper.find(".stream-canvas").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Stream ended");
  });

  it("says the stream ended instead of retrying once it is stopped", async () => {
    const wrapper = await mountPlayer();
    await pushStream(streamRow);
    await pushStream(null);

    expect(wrapper.find(".stream-canvas").exists()).toBe(false);
    expect(wrapper.text()).toContain("Stream ended");
  });

  it("does not call a stream ended before it has started", async () => {
    const wrapper = await mountPlayer();
    await pushStream(null);

    expect(wrapper.text()).not.toContain("Stream ended");
  });

  it("picks back up when a new stream starts for the match", async () => {
    const wrapper = await mountPlayer();
    await pushStream(streamRow);
    await pushStream(null);
    await pushStream({ ...streamRow, id: "stream-2" });

    expect(wrapper.find(".stream-canvas").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Stream ended");
  });
});
