import { ref, shallowRef, computed, watch } from "vue";
import type { DocumentNode } from "graphql";
import { useApolloClient } from "@vue/apollo-composable";
import { usePlayerCompareTarget } from "./usePlayerCompareTarget";

export interface ComparisonPlayer {
  steam_id: string;
  name: string;
  avatar_url?: string;
}

export function usePlayerComparison<T = any>(
  query: DocumentNode,
  buildVariables: (steamId: string) => Record<string, unknown>,
  extract: (data: any) => T,
  // Optional getter of the parent's filter values (source/matchType/since/limit)
  // so the overlay re-fetches when filters change, not just when the target does.
  deps?: () => unknown[],
) {
  const { client: apolloClient } = useApolloClient();
  // The selected opponent is shared across every tab (set once by the page's
  // global Compare control), so each tab just runs its own query for it.
  const { compareTarget } = usePlayerCompareTarget();

  const compareLoading = ref(false);
  const compareData = shallowRef<T | null>(null);
  const enabled = computed(() => !!compareTarget.value);

  let loadGen = 0;

  async function load() {
    const player = compareTarget.value;
    if (!player?.steam_id) {
      compareData.value = null;
      compareLoading.value = false;
      return;
    }
    compareLoading.value = true;
    const gen = ++loadGen;
    try {
      const { data } = await apolloClient.query({
        query,
        variables: buildVariables(String(player.steam_id)),
        fetchPolicy: "network-only",
      });
      if (gen !== loadGen) {
        return;
      }
      compareData.value = extract(data);
    } catch {
      if (gen === loadGen) {
        compareData.value = null;
      }
    } finally {
      if (gen === loadGen) {
        compareLoading.value = false;
      }
    }
  }

  watch(
    () => [compareTarget.value?.steam_id, ...(deps ? deps() : [])],
    () => load(),
    { immediate: true },
  );

  return {
    enabled,
    comparePlayer: compareTarget,
    compareLoading,
    compareData,
  };
}
