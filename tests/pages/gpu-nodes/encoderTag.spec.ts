import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import GpuNodesPage from "~/pages/gpu-nodes/index.vue";

// An AMD APU node as the game_server_nodes subscription returns it.
const amdNode = {
  id: "node-1",
  label: "Node 1",
  status: "Online",
  enabled: true,
  enabled_for_match_making: true,
  accepting_new_matches: true,
  region: null,
  gpu: true,
  gpu_vendor: "amd",
  gpu_info: [{ index: 0, name: "AMD Radeon 8060S Graphics", memory_mb: 49152 }],
  gpu_streaming_enabled: true,
  gpu_demos_enabled: true,
  gpu_rendering_enabled: true,
  cs2_video_settings: null,
  public_ip: null,
  lan_ip: null,
  offline_at: null,
  start_port_range: 30000,
  end_port_range: 30100,
  shader_bake_status: null,
  shader_bake_progress: null,
  shader_bake_progress_stage: null,
  shader_bake_status_history: null,
  e_region: null,
  e_status: { description: "Online" },
};

let mounted: { unmount: () => void } | null = null;
let queries: any[] = [];

function rootField(query: any): string | undefined {
  return query.definitions[0]?.selectionSet?.selections[0]?.name?.value;
}

function selectedFields(query: any): string[] {
  const root = query?.definitions[0]?.selectionSet?.selections[0];
  return (root?.selectionSet?.selections ?? []).map(
    (selection: any) => selection.name.value,
  );
}

// Answers each subscription the page opens with the rows given for its root
// field; subscriptions without rows never answer.
async function mountPage(rows: Record<string, unknown[]>) {
  queries = [];
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      queries.push(options.query);
      const field = rootField(options.query);
      if (field && rows[field]) {
        Promise.resolve().then(() =>
          observer.next({ data: { [field]: rows[field] } }),
        );
      }
      return { unsubscribe() {}, closed: false };
    },
  }));

  const wrapper = await mountSuspended(GpuNodesPage, {
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: {
        NodeControlMenu: true,
        NodeGpuMetrics: true,
        ServiceLogs: true,
        SnapshotQuickView: true,
        BootSequence: true,
        EditCs2Options: true,
        Tooltip: true,
      },
    },
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});


const at = "2026-10-07T12:00:00.000Z";
const matchup = {
  id: "match-1",
  lineup_1: { name: "Team A" },
  lineup_2: { name: "Team B" },
};

// A GOTV stream on node-1 that went live with the VA-API encoder.
const liveStream = {
  id: "stream-1",
  match_id: "match-1",
  status: "live",
  status_history: [
    { status: "launching_cs2", at },
    { status: "live", at, progress_stage: "encoder:vah264enc" },
  ],
  mode: "tv",
  is_live: true,
  game_server_node_id: "node-1",
  match: matchup,
};

// A demo session on node-1 that fell back to the CPU encoder, then played.
const demoSession = {
  id: "session-1",
  match_id: "match-1",
  status: "playing",
  status_history: [
    { status: "live", at, progress_stage: "encoder:x264enc" },
    { status: "playing", at },
  ],
  game_server_node_id: "node-1",
  created_at: at,
  watcher: { steam_id: "76561198000000001", name: "Viewer" },
  match: matchup,
};

// A highlight render on node-1. Its history carries a marker only to show
// that renders never get the tag.
const renderJob = {
  id: "job-1",
  status: "rendering",
  progress: 42,
  status_history: [{ status: "live", at, progress_stage: "encoder:vah264enc" }],
  game_server_node_id: "node-1",
  user_steam_id: null,
  user: null,
  match_map: { id: "map-1", match: matchup },
};

describe("gpu nodes page: encoder tag in the busy pill", () => {
  it("tags a live stream with its encoder", async () => {
    const wrapper = await mountPage({
      game_server_nodes: [amdNode],
      match_streams: [liveStream],
    });

    const tag = wrapper.find(".gpu-node-task .gpu-node-task-encoder");
    expect(tag.exists()).toBe(true);
    expect(tag.text()).toBe("vah264enc");
    expect(tag.attributes("title")).toBe("Video encoder: vah264enc");
    expect(tag.classes()).not.toContain("gpu-node-task-encoder-warn");
  });

  it("warning-styles the CPU fallback on a playing demo", async () => {
    const wrapper = await mountPage({
      game_server_nodes: [amdNode],
      match_demo_sessions: [demoSession],
    });

    const tag = wrapper.find(".gpu-node-task .gpu-node-task-encoder");
    expect(tag.exists()).toBe(true);
    expect(tag.text()).toBe("x264enc");
    expect(tag.classes()).toContain("gpu-node-task-encoder-warn");
  });

  it("keeps an NVIDIA node's live pill without a tag", async () => {
    const wrapper = await mountPage({
      game_server_nodes: [
        {
          ...amdNode,
          gpu_vendor: "nvidia",
          gpu_info: [
            { index: 0, name: "NVIDIA GeForce RTX 4070", memory_mb: 12282 },
          ],
        },
      ],
      match_streams: [
        {
          ...liveStream,
          status_history: [
            { status: "launching_cs2", at },
            { status: "live", at },
          ],
        },
      ],
    });

    expect(wrapper.find(".gpu-node-task-label").exists()).toBe(true);
    expect(wrapper.find(".gpu-node-task-encoder").exists()).toBe(false);
  });

  it("shows no tag for a render", async () => {
    const wrapper = await mountPage({
      game_server_nodes: [amdNode],
      clip_render_jobs: [renderJob],
    });

    expect(wrapper.find(".gpu-node-task-label").exists()).toBe(true);
    expect(wrapper.find(".gpu-node-task-encoder").exists()).toBe(false);
  });
});

describe("gpu nodes page: NVIDIA CPU encoding", () => {
  it("shows the CPU warning on NVIDIA too", async () => {
    const wrapper = await mountPage({
      game_server_nodes: [{
        ...amdNode,
        gpu_vendor: "nvidia",
        gpu_info: [{ index: 0, name: "NVIDIA GeForce RTX 4070", memory_mb: 12282 }],
      }],
      match_demo_sessions: [demoSession],
    });
    const tag = wrapper.find(".gpu-node-task-encoder");
    expect(tag.text()).toBe("x264enc");
    expect(tag.classes()).toContain("gpu-node-task-encoder-warn");
  });
});
