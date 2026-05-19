import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { defineStore, acceptHMRUpdate } from "pinia";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

type PoolStatus = {
  total_gpu_nodes: number;
  free_gpu_nodes: number;
  registered_gpu_nodes: number;
  live_in_progress: boolean;
  demo_in_progress: boolean;
  highlights_in_progress: boolean;
};

export const useGpuPoolStatusStore = defineStore("gpu-pool-status", () => {
  const { t } = useI18n();
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

  const busyReason = computed<string | null>(() => {
    const s = status.value;
    if (!s) return null;
    if (s.total_gpu_nodes <= 0) {
      return t("gpu_pool_status.no_nodes");
    }
    if (s.free_gpu_nodes > 0) return null;
    if (s.live_in_progress) return t("gpu_pool_status.live_busy");
    if (s.demo_in_progress) return t("gpu_pool_status.demo_busy");
    if (s.highlights_in_progress) return t("gpu_pool_status.highlights_busy");
    return t("stream_status.gpu_busy");
  });

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
            registered_gpu_nodes: true,
            live_in_progress: true,
            demo_in_progress: true,
            highlights_in_progress: true,
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
              registered_gpu_nodes: Number(row.registered_gpu_nodes ?? 0),
              live_in_progress: !!row.live_in_progress,
              demo_in_progress: !!row.demo_in_progress,
              highlights_in_progress: !!row.highlights_in_progress,
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
    busyReason,
    subscribeToPool,
    unsubscribe,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useGpuPoolStatusStore, import.meta.hot),
  );
}
