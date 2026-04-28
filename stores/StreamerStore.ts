import { ref, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

// Single source of truth for game-streamer rows. Both the Stream Deck
// page (full row UI) and the sidebar badge (count) consume this — one
// websocket subscription instead of two parallel ones with overlapping
// queries.
export const useStreamerStore = defineStore("streamer", () => {
  const liveStreams = ref<any[]>([]);
  const hasLoaded = ref(false);
  // Count of game-server-nodes that report GPU + are enabled. Drives
  // the "no GPU available" hint on the Stream Deck — game-streamer
  // pods can't run without a GPU node to schedule onto.
  const gpuNodeCount = ref(0);
  const hasLoadedGpuNodes = ref(false);

  // Distinct match count — multiple caster rows on a single match
  // would otherwise inflate the badge.
  const activeStreamingMatchesCount = computed(() => {
    const ids = new Set<string>();
    for (const s of liveStreams.value) {
      if (s?.match_id) ids.add(s.match_id);
    }
    return ids.size;
  });

  // Concurrent-stream cap. Hardcoded to 1 for now — single source of
  // truth so when the backend starts publishing a real value (computed
  // from configured stream credentials × game-server-nodes that report
  // gpu=true && enabled=true), it's a one-line swap to drop a ref/
  // computed in here that pulls from the API. The rest of the UI
  // already reads `maxStreams` / `isAtCapacity` so no consumer changes
  // are needed.
  // TODO(backend): replace with subscription on a capacity field once
  // the API exposes one — e.g. a `streaming_capacity` query/setting
  // gated on stream credentials being configured AND at least one
  // gpu-enabled node.
  const maxStreams = computed(() => 1);

  const isAtCapacity = computed(
    () => activeStreamingMatchesCount.value >= maxStreams.value,
  );

  const hasGpuNode = computed(() => gpuNodeCount.value > 0);

  let started = false;
  let gpuNodesStarted = false;

  const subscribeToLiveStreams = () => {
    if (started) return;
    started = true;

    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        match_streams: [
          {
            where: { is_game_streamer: { _eq: true } },
            order_by: [{ priority: order_by.asc }, { id: order_by.asc }],
          },
          {
            id: true,
            match_id: true,
            title: true,
            link: true,
            is_live: true,
            status: true,
            stream_url: true,
            error_message: true,
            last_status_at: true,
            autodirector: true,
            match: {
              id: true,
              status: true,
              options: { type: true },
              lineup_1: { name: true },
              lineup_2: { name: true },
            },
          },
        ],
      }),
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "streamer:liveStreams",
      subscription.subscribe({
        next: ({ data }: any) => {
          liveStreams.value = data?.match_streams ?? [];
          hasLoaded.value = true;
        },
        error: (error: any) => {
          console.error("Error in streamer liveStreams subscription:", error);
        },
      }),
    );
  };

  const subscribeToGpuNodes = () => {
    if (gpuNodesStarted) return;
    gpuNodesStarted = true;

    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        game_server_nodes_aggregate: [
          {
            where: {
              gpu: { _eq: true },
              enabled: { _eq: true },
            },
          },
          {
            aggregate: {
              count: true,
            },
          },
        ],
      }),
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "streamer:gpuNodes",
      subscription.subscribe({
        next: ({ data }: any) => {
          gpuNodeCount.value =
            data?.game_server_nodes_aggregate?.aggregate?.count || 0;
          hasLoadedGpuNodes.value = true;
        },
        error: (error: any) => {
          console.error("Error in streamer gpuNodes subscription:", error);
        },
      }),
    );
  };

  return {
    liveStreams,
    hasLoaded,
    activeStreamingMatchesCount,
    maxStreams,
    isAtCapacity,
    gpuNodeCount,
    hasLoadedGpuNodes,
    hasGpuNode,
    subscribeToLiveStreams,
    subscribeToGpuNodes,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useStreamerStore, import.meta.hot));
}
