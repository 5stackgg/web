import { ref } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

// Module-level flag the WHEP player gates retries on while a render
// is in flight. Pod stops its live SRT publisher during a render,
// so reconnect attempts 404 — the flag tells WhepPlayer to freeze on
// the last frame and skip retries until the render finishes.
//
// Lifecycle is intentionally decoupled from the UI dialog: the dialog
// can close mid-render without clearing the flag, and the flag still
// auto-clears on its own when the render reaches a terminal status
// (done / error / cancelled). Achieved by having the composable own
// a Hasura subscription keyed by job_id; we tear it down + flip the
// flag the moment a terminal status lands.
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

// Set a job as the active render. Starts a subscription that auto-
// clears the active flag when the job hits a terminal state. Calling
// this with a different job id swaps the subscription. Calling with
// null forces inactive immediately.
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

  // Server-side subscription is the source of truth — covers the
  // "user closed the dialog mid-render" case where there's no UI
  // component owning the lifecycle.
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      // Cast: clip_render_jobs is gated behind its own migration in
      // the api repo; the zeus types lag the schema until codegen
      // runs. Same dance as elsewhere.
      clip_render_jobs: [
        { where: { id: { _eq: jobId } }, limit: 1 } as any,
        { id: true, status: true },
      ],
    } as any),
  });
  watchSub = obs.subscribe({
    next: ({ data }: any) => {
      const row = data?.clip_render_jobs?.[0];
      // Row deleted or never existed — bail out so we don't hold
      // the flag forever.
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
      // Don't clear on error — the next reconnect may recover. The
      // worst case is the flag staying stuck through one missed
      // terminal event, which the explicit setActive(false) calls
      // from ClipRenderProgress catch.
    },
  });
}

export function useClipRenderActive() {
  return {
    active,
    // Backwards-compat — callers that only know "true/false". When
    // they pass `true` without a job id we still flip the flag, but
    // it'll need an explicit `false` later (or another setActive
    // with a job id) to clear, since there's no subscription to
    // ride a terminal status.
    setActive: (v: boolean | string | null) => {
      if (typeof v === "string") {
        trackJob(v);
      } else if (v === false || v === null) {
        trackJob(null);
      } else {
        active.value = !!v;
      }
    },
    // Preferred entry point for new callers — pass the job id and
    // forget. The flag self-manages from there.
    trackJob,
  };
}
