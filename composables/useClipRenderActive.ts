import { ref } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

// WHEP gate while a render is in flight. The pod stops its SRT
// publisher during render; without this gate the player would burn
// retries 404ing until the render finishes. Auto-clears when the
// job hits a terminal status, so closing the UI mid-render is fine.
const active = ref(false);
const TERMINAL = new Set(["done", "error", "cancelled"]);

let watchedJobId: string | null = null;
let watchSub: { unsubscribe: () => void } | null = null;

function clearWatch() {
  if (watchSub) {
    watchSub.unsubscribe();
    watchSub = null;
  }
  watchedJobId = null;
}

function trackJob(jobId: string | null) {
  if (!jobId) {
    clearWatch();
    active.value = false;
    return;
  }
  if (jobId === watchedJobId) return;
  clearWatch();
  watchedJobId = jobId;
  active.value = true;

  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      // Cast: clip_render_jobs lags zeus codegen.
      clip_render_jobs: [
        { where: { id: { _eq: jobId } }, limit: 1 } as any,
        { id: true, status: true },
      ],
    } as any),
  });
  watchSub = obs.subscribe({
    next: ({ data }: any) => {
      const row = data?.clip_render_jobs?.[0];
      if (!row) {
        clearWatch();
        active.value = false;
        return;
      }
      if (TERMINAL.has(row.status)) {
        clearWatch();
        active.value = false;
      }
    },
    error: (err: any) => {
      console.error("[clip-render-active] subscription error:", err);
    },
  });
}

export function useClipRenderActive() {
  return { active, trackJob };
}
