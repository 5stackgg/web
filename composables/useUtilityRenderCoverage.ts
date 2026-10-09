import { onScopeDispose, ref, shallowRef, watch } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityLineupRenderCoverageQuery } from "~/graphql/utilityRenderGraphql";
import type { UtilityRenderCoverage } from "~/types/utility";

const SOON_MS = 1500;

// What the library's previews are missing, for one map or all of them. The
// api works it out over every public lineup, so it is asked when something
// changed and not on a timer.
export function useUtilityRenderCoverage() {
  const client = getGraphqlClient();
  const coverage = shallowRef<UtilityRenderCoverage | null>(null);
  const failed = ref(false);
  const map = ref<string | null>(null);

  let asked = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function settle() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function refresh() {
    settle();
    const mine = ++asked;
    try {
      const { data } = await client.query({
        query: utilityLineupRenderCoverageQuery,
        variables: { map_name: map.value },
        fetchPolicy: "network-only",
      });
      // Answers land in the order they finish, not the order they were asked.
      if (mine !== asked) {
        return;
      }
      coverage.value = (data as any)?.utilityLineupRenderCoverage ?? null;
      failed.value = !coverage.value;
    } catch (error) {
      if (mine !== asked) {
        return;
      }
      console.error("[utility-render-queue] coverage:", error);
      failed.value = true;
    }
  }

  // For what arrives in bursts: a queue of forty lineups changes forty times.
  function refreshSoon() {
    settle();
    timer = setTimeout(() => void refresh(), SOON_MS);
  }

  watch(map, () => void refresh());

  onScopeDispose(() => {
    settle();
    asked++;
  });

  return { coverage, failed, map, refresh, refreshSoon };
}
