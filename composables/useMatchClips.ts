import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import type { Clip } from "~/types/clip";

// Single subscription for every clip belonging to a match (across all
// of its match_maps). Returned shape is reactive — consumers can read
// the flat list, or pull a per-player Map keyed by target_steam_id to
// drive in-place clip indicators next to player names without each
// row spinning up its own subscription.
export function useMatchClips(matchId: Ref<string | null | undefined> | ComputedRef<string | null | undefined>) {
  const clips = ref<Clip[]>([]);
  const loading = ref(true);

  let activeSub: { unsubscribe: () => void } | null = null;

  function subscribe() {
    activeSub?.unsubscribe();
    activeSub = null;
    clips.value = [];
    const id = matchId.value;
    if (!id) {
      loading.value = false;
      return;
    }
    loading.value = true;
    const obs = getGraphqlClient().subscribe({
      query: generateSubscription({
        match_clips: [
          {
            where: {
              match_map: { match_id: { _eq: id } },
            },
            order_by: [{ created_at: "desc" }],
            limit: 200,
          } as any,
          matchClipFields,
        ],
      } as any),
    });
    activeSub = obs.subscribe({
      next: ({ data }: any) => {
        clips.value = data?.match_clips ?? [];
        loading.value = false;
      },
      error: (err: any) => {
        console.error("[useMatchClips] subscription error:", err);
        loading.value = false;
      },
    });
  }

  watch(matchId, () => subscribe(), { immediate: true });
  onBeforeUnmount(() => {
    activeSub?.unsubscribe();
    activeSub = null;
  });

  // Per-target map for fast O(1) lookup from a steam_id. Builds once
  // per clip update — the cost is linear in clips.length and clips is
  // capped at 200 by the subscription, so this is cheap.
  const byTarget = computed(() => {
    const m = new Map<string, Clip[]>();
    for (const c of clips.value) {
      const sid = c.target_steam_id;
      if (!sid) continue;
      const list = m.get(sid) ?? [];
      list.push(c);
      m.set(sid, list);
    }
    return m;
  });

  // Per-match-map grouping for the clips tab — sub-sections in BO3+.
  const byMatchMap = computed(() => {
    const m = new Map<string, Clip[]>();
    for (const c of clips.value) {
      const id = c.match_map?.id;
      if (!id) continue;
      const list = m.get(id) ?? [];
      list.push(c);
      m.set(id, list);
    }
    return m;
  });

  return { clips, loading, byTarget, byMatchMap };
}
