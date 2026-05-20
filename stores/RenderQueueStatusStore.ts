import { ref, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

export const useRenderQueueStatusStore = defineStore(
  "render-queue-status",
  () => {
    const queuedCount = ref(0);
    const renderingCount = ref(0);
    const uploadingCount = ref(0);
    const lastUpdateAt = ref<number | null>(null);
    const hasLoaded = ref(false);

    let subscriptionStarted = false;
    let activeSub: { unsubscribe: () => void } | null = null;

    const inFlightCount = computed(
      () => queuedCount.value + renderingCount.value + uploadingCount.value,
    );

    function subscribeToInFlight() {
      if (subscriptionStarted) return;
      subscriptionStarted = true;

      // Row-level (not _aggregate) so we don't need allow_aggregations
      // on the table permission — uses the same select permission the
      // panel already relies on. In-flight rows are bounded by active
      // batches, so payload stays small.
      const obs = getGraphqlClient().subscribe({
        query: generateSubscription({
          clip_render_jobs: [
            {
              where: {
                status: {
                  _in: ["queued", "rendering", "uploading"],
                },
              },
            } as any,
            { id: true, status: true },
          ],
        } as any),
      });

      activeSub = obs.subscribe({
        next: ({ data }: any) => {
          const rows = data?.clip_render_jobs ?? [];
          let q = 0;
          let r = 0;
          let u = 0;
          for (const row of rows) {
            if (row.status === "queued") q++;
            else if (row.status === "rendering") r++;
            else if (row.status === "uploading") u++;
          }
          queuedCount.value = q;
          renderingCount.value = r;
          uploadingCount.value = u;
          lastUpdateAt.value = Date.now();
          hasLoaded.value = true;
        },
        error: (err: any) => {
          console.error("[render-queue-status] subscription error:", err);
          subscriptionStarted = false;
        },
      });
    }

    function unsubscribe() {
      activeSub?.unsubscribe();
      activeSub = null;
      subscriptionStarted = false;
      queuedCount.value = 0;
      renderingCount.value = 0;
      uploadingCount.value = 0;
      lastUpdateAt.value = null;
      hasLoaded.value = false;
    }

    return {
      inFlightCount,
      queuedCount,
      renderingCount,
      uploadingCount,
      lastUpdateAt,
      hasLoaded,
      subscribeToInFlight,
      unsubscribe,
    };
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useRenderQueueStatusStore, import.meta.hot),
  );
}
