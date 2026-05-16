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
import { order_by } from "~/generated/zeus";

// One subscription shared by the match page; consumers fan out via
// the byTarget / byMatchMap maps so each row doesn't open its own.
export function useMatchClips(
  matchId:
    | Ref<string | null | undefined>
    | ComputedRef<string | null | undefined>,
) {
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
            order_by: [
              { kills_count: order_by.desc_nulls_last },
              { created_at: order_by.desc },
            ],
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
