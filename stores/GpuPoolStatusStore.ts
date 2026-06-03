import { ref, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

type PoolStatus = {
  total_gpu_nodes: number;
  free_gpu_nodes: number;
  free_gpu_nodes_for_batch: number;
  renders_paused_for_active_match: boolean;
  registered_gpu_nodes: number;
  live_in_progress: boolean;
  demo_in_progress: boolean;
  highlights_in_progress: boolean;
  streaming_total_gpu_nodes: number;
  streaming_free_gpu_nodes: number;
  demo_total_gpu_nodes: number;
  demo_free_gpu_nodes: number;
  rendering_total_gpu_nodes: number;
};

export type GpuWorkload = "streaming" | "demo" | "rendering";

export type GpuAvailability = {
  hasFree: boolean;
  busyReasonKey: string | null;
};

export const useGpuPoolStatusStore = defineStore("gpu-pool-status", () => {
  const status = ref<PoolStatus | null>(null);
  const hasLoaded = ref(false);

  let subscriptionStarted = false;
  let activeSub: { unsubscribe: () => void } | null = null;

  const hasFreeGpu = computed(() => {
    const s = status.value;
    if (!s) return true;
    if (s.total_gpu_nodes <= 0) return false;
    return s.free_gpu_nodes > 0;
  });

  // Highlight queueing only needs a GPU node to *exist* (offline is fine —
  // BatchHighlightsRenderJob retries until it's back online). This lets the
  // UI distinguish "no GPU registered, button must be disabled" from
  // "GPU offline, queue anyway".
  const hasRegisteredGpu = computed(() => {
    const s = status.value;
    if (!s) return true;
    return s.registered_gpu_nodes > 0;
  });

  // Return an i18n key (or null). Translation happens at the consumer
  // via useGpuAvailability — keeping the store free of `useI18n()`
  // means its setup can't half-initialise when the first caller is an
  // async callback (apollo `next`, socket events) outside any Vue
  // setup context, which used to strand consumers with an `undefined`
  // ref off `storeToRefs(store)`.
  const busyReasonKey = computed<string | null>(() => {
    const s = status.value;
    if (!s) return null;
    if (s.total_gpu_nodes <= 0) return "gpu_pool_status.no_nodes";
    if (s.free_gpu_nodes > 0) return null;
    if (s.live_in_progress) return "gpu_pool_status.live_busy";
    if (s.demo_in_progress) return "gpu_pool_status.demo_busy";
    if (s.highlights_in_progress) return "gpu_pool_status.highlights_busy";
    return "stream_status.gpu_busy";
  });

  // Per-workload availability. Each GPU workload (live streaming / demo
  // playback / rendering) has its own toggle, so the watch-demo button must
  // not be gated by the streaming toggle and vice versa. `rendering` uses the
  // batch free count, which already accounts for renders paused by an active
  // match.
  function getAvailability(workload: GpuWorkload): GpuAvailability {
    const s = status.value;
    if (!s) return { hasFree: true, busyReasonKey: null };

    const total =
      workload === "streaming"
        ? s.streaming_total_gpu_nodes
        : workload === "demo"
          ? s.demo_total_gpu_nodes
          : s.rendering_total_gpu_nodes;
    const free =
      workload === "streaming"
        ? s.streaming_free_gpu_nodes
        : workload === "demo"
          ? s.demo_free_gpu_nodes
          : s.free_gpu_nodes_for_batch;

    if (total <= 0) {
      // A GPU exists but this workload is turned off everywhere vs. no GPU
      // registered at all — distinct messages so the user knows which knob.
      const busyReasonKey =
        s.registered_gpu_nodes > 0
          ? `gpu_pool_status.${workload}_disabled`
          : "gpu_pool_status.no_nodes";
      return { hasFree: false, busyReasonKey };
    }
    if (free > 0) return { hasFree: true, busyReasonKey: null };

    let busyReasonKey: string;
    if (s.live_in_progress) busyReasonKey = "gpu_pool_status.live_busy";
    else if (s.demo_in_progress) busyReasonKey = "gpu_pool_status.demo_busy";
    else if (s.highlights_in_progress)
      busyReasonKey = "gpu_pool_status.highlights_busy";
    else busyReasonKey = "stream_status.gpu_busy";
    return { hasFree: false, busyReasonKey };
  }

  function subscribeToPool() {
    if (subscriptionStarted) return;
    subscriptionStarted = true;

    const obs = getGraphqlClient().subscribe({
      query: generateSubscription({
        v_gpu_pool_status: [
          { limit: 1 } as any,
          {
            total_gpu_nodes: true,
            free_gpu_nodes: true,
            free_gpu_nodes_for_batch: true,
            renders_paused_for_active_match: true,
            registered_gpu_nodes: true,
            live_in_progress: true,
            demo_in_progress: true,
            highlights_in_progress: true,
            streaming_total_gpu_nodes: true,
            streaming_free_gpu_nodes: true,
            demo_total_gpu_nodes: true,
            demo_free_gpu_nodes: true,
            rendering_total_gpu_nodes: true,
          },
        ],
      } as any),
    });

    activeSub = obs.subscribe({
      next: ({ data }: any) => {
        const row = data?.v_gpu_pool_status?.[0];
        status.value = row
          ? {
              total_gpu_nodes: Number(row.total_gpu_nodes ?? 0),
              free_gpu_nodes: Number(row.free_gpu_nodes ?? 0),
              free_gpu_nodes_for_batch: Number(
                row.free_gpu_nodes_for_batch ?? 0,
              ),
              renders_paused_for_active_match:
                !!row.renders_paused_for_active_match,
              registered_gpu_nodes: Number(row.registered_gpu_nodes ?? 0),
              live_in_progress: !!row.live_in_progress,
              demo_in_progress: !!row.demo_in_progress,
              highlights_in_progress: !!row.highlights_in_progress,
              streaming_total_gpu_nodes: Number(
                row.streaming_total_gpu_nodes ?? 0,
              ),
              streaming_free_gpu_nodes: Number(
                row.streaming_free_gpu_nodes ?? 0,
              ),
              demo_total_gpu_nodes: Number(row.demo_total_gpu_nodes ?? 0),
              demo_free_gpu_nodes: Number(row.demo_free_gpu_nodes ?? 0),
              rendering_total_gpu_nodes: Number(
                row.rendering_total_gpu_nodes ?? 0,
              ),
            }
          : null;
        hasLoaded.value = true;
      },
      error: (err: any) => {
        console.error("[gpu-pool-status] subscription error:", err);
        subscriptionStarted = false;
      },
    });
  }

  function unsubscribe() {
    activeSub?.unsubscribe();
    activeSub = null;
    subscriptionStarted = false;
    status.value = null;
    hasLoaded.value = false;
  }

  return {
    status,
    hasLoaded,
    hasFreeGpu,
    hasRegisteredGpu,
    busyReasonKey,
    getAvailability,
    subscribeToPool,
    unsubscribe,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useGpuPoolStatusStore, import.meta.hot),
  );
}
