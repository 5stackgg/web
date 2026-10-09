import { computed, onScopeDispose, shallowRef, watch } from "vue";
import { e_player_roles_enum } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityRendersInFlightBriefSubscription } from "~/graphql/utilityRenderGraphql";
import { useAuthStore } from "~/stores/AuthStore";
import { utilityLineupsRendering } from "~/utilities/utilityRenderQueue";

export type UtilityRenderInFlight = {
  id: string;
  utility_lineup_id: string;
  status: "queued" | "rendering" | "uploading";
  /** Hasura sends numeric(4,3) as a STRING. */
  progress: number | string | null;
};

// One subscription for every row, panel and tab that asks, kept only while
// something is asking.
const rows = shallowRef<UtilityRenderInFlight[]>([]);
let askers = 0;
let live: { unsubscribe: () => void } | null = null;

function start() {
  if (live) {
    return;
  }
  live = getGraphqlClient()
    .subscribe({ query: utilityRendersInFlightBriefSubscription })
    .subscribe({
      next: ({ data }: any) => {
        rows.value = data?.utility_lineup_renders ?? [];
      },
      error: (error: any) => {
        console.error("[utility] in-flight renders:", error);
      },
    });
}

function stop() {
  live?.unsubscribe();
  live = null;
  rows.value = [];
}

/**
 * Which lineups have a preview render under way. Hasura lets only moderators
 * and up read render rows, so for everyone else this stays empty and never
 * asks -- which is also why only they can start a render in the first place.
 */
export function useUtilityRendersInFlight() {
  const auth = useAuthStore();
  let asking = false;

  if (import.meta.client) {
    watch(
      () => auth.isRoleAbove(e_player_roles_enum.moderator),
      (canRead) => {
        if (canRead && !asking) {
          asking = true;
          askers++;
          start();
        }
      },
      { immediate: true },
    );

    onScopeDispose(() => {
      if (asking && --askers === 0) {
        stop();
      }
    });
  }

  const lineups = computed(() => utilityLineupsRendering(rows.value));

  function percent(lineupId: string): number | null {
    const row = rows.value.find(
      (entry) => entry.utility_lineup_id === lineupId,
    );
    if (!row || row.status === "queued") {
      return null;
    }
    const value = Math.round(Number(row.progress ?? 0) * 100);
    return Number.isFinite(value) ? value : null;
  }

  return {
    count: computed(() => rows.value.length),
    isRendering: (lineupId: string) => lineups.value.has(lineupId),
    percent,
  };
}
