<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Film, ArrowRight } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import { Skeleton } from "~/components/ui/skeleton";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import MatchClipsGroupCard from "~/components/clips/MatchClipsGroupCard.vue";
import type { Clip } from "~/types/clip";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Hides itself when there are no clips. `sectionLabel` opts into the
// tactical header wrapper so the label hides with the strip.
const props = withDefaults(
  defineProps<{
    limit?: number;
    title?: string;
    showHeader?: boolean;
    sectionLabel?: string;
  }>(),
  {
    limit: 8,
    title: "Recent Highlights",
    showHeader: true,
  },
);

// Match-first feed: subscription A picks the top-N matches by most
// recent clip (distinct_on per match_map, deduped to match.id client-
// side), then subscription B fetches every clip for those matches so
// the group cards render the same count / featured targets they would
// on the full highlights page.
//
// LEAD_POOL is the slack for the dedupe step: distinct_on hits per
// match_map, and Bo3+ matches can contribute several maps with clips.
// Keeping it a few × the display limit ensures we still find limit
// distinct matches even when the recent stream is heavy on multi-map
// tournaments.
const LEAD_POOL = Math.max(40, props.limit * 4);

const clips = ref<Clip[]>([]);
const loadingLeads = ref(true);
const loadingClips = ref(true);
const loading = computed(() => loadingLeads.value || loadingClips.value);

// Top-N match IDs (newest clip first). Drives the second subscription.
const topMatchIds = ref<string[]>([]);

let leadSub: { unsubscribe: () => void } | null = null;
let clipsSub: { unsubscribe: () => void } | null = null;

function subscribeLeads() {
  leadSub?.unsubscribe();
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        {
          where: { visibility: { _eq: "public" } },
          // distinct_on requires the leading order_by column to match.
          distinct_on: ["match_map_id"],
          order_by: [{ match_map_id: "asc" }, { created_at: "desc" }],
          limit: LEAD_POOL,
        } as any,
        // Lightweight projection — we only need the lead clip's match
        // identity to derive the top-N match list.
        {
          created_at: true,
          match_map: {
            match: { id: true },
          },
        },
      ],
    } as any),
  });
  leadSub = obs.subscribe({
    next: ({ data }: any) => {
      const leads = (data?.match_clips ?? []) as Array<{
        created_at: string;
        match_map?: { match?: { id?: string } } | null;
      }>;
      const ordered = [...leads].sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
      );
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const row of ordered) {
        const mid = row.match_map?.match?.id;
        if (!mid || seen.has(mid)) continue;
        seen.add(mid);
        ids.push(mid);
        if (ids.length >= props.limit) break;
      }
      topMatchIds.value = ids;
      loadingLeads.value = false;
      if (ids.length === 0) {
        clips.value = [];
        loadingClips.value = false;
      }
    },
    error: (err: any) => {
      console.error("[recent-highlights] lead subscription error:", err);
      loadingLeads.value = false;
      loadingClips.value = false;
    },
  });
}

function subscribeClips(matchIds: string[]) {
  clipsSub?.unsubscribe();
  clipsSub = null;
  if (matchIds.length === 0) {
    clips.value = [];
    loadingClips.value = false;
    return;
  }
  loadingClips.value = true;
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        {
          where: {
            _and: [
              { visibility: { _eq: "public" } },
              { match_map: { match_id: { _in: matchIds } } },
            ],
          },
          order_by: [{ created_at: "desc" }],
        } as any,
        matchClipFields,
      ],
    } as any),
  });
  clipsSub = obs.subscribe({
    next: ({ data }: any) => {
      clips.value = data?.match_clips ?? [];
      loadingClips.value = false;
    },
    error: (err: any) => {
      console.error("[recent-highlights] clips subscription error:", err);
      loadingClips.value = false;
    },
  });
}

subscribeLeads();
watch(
  topMatchIds,
  (ids, prev) => {
    // Only resubscribe when the set actually changes — a no-op match
    // list shouldn't reset clipsSub on every lead push.
    if (
      prev &&
      ids.length === prev.length &&
      ids.every((id, i) => id === prev[i])
    ) {
      return;
    }
    subscribeClips(ids);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  leadSub?.unsubscribe();
  clipsSub?.unsubscribe();
});

const hasClips = computed(() => clips.value.length > 0);
const showMap = computed(() => {
  const seen = new Set<string>();
  for (const c of clips.value) {
    const name = c.match_map?.map?.name;
    if (name) seen.add(name);
    if (seen.size > 1) return true;
  }
  return false;
});
// Skip the skeleton when sectionLabel is set — a flash of header +
// skeleton then vanish is worse than one beat of nothing.
const shouldRender = computed(() =>
  props.sectionLabel ? hasClips.value : loading.value || hasClips.value,
);

// Mirror the highlights page: collapse multi-clip matches into a
// single group card, keep singletons as HighlightCards, and sort the
// resulting items by the newest clip in each.
type GridItem =
  | { kind: "single"; clip: Clip; sortKey: string }
  | { kind: "group"; matchId: string; clips: Clip[]; sortKey: string };
const gridItems = computed<GridItem[]>(() => {
  const byMatch = new Map<string, Clip[]>();
  const orphans: Clip[] = [];
  for (const c of clips.value) {
    const matchId = c.match_map?.match?.id;
    if (!matchId) {
      orphans.push(c);
      continue;
    }
    const list = byMatch.get(matchId) ?? [];
    list.push(c);
    byMatch.set(matchId, list);
  }
  const items: GridItem[] = [];
  for (const [matchId, group] of byMatch) {
    const sorted = [...group].sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
    );
    if (sorted.length === 1) {
      items.push({
        kind: "single",
        clip: sorted[0],
        sortKey: sorted[0].created_at,
      });
    } else {
      items.push({
        kind: "group",
        matchId,
        clips: sorted,
        sortKey: sorted[0].created_at,
      });
    }
  }
  for (const c of orphans) {
    items.push({ kind: "single", clip: c, sortKey: c.created_at });
  }
  items.sort((a, b) =>
    a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0,
  );
  return items.slice(0, props.limit);
});
</script>

<template>
  <div v-if="shouldRender">
    <div
      v-if="sectionLabel"
      :class="[
        tacticalSectionLabelClasses,
        'flex items-center justify-between',
      ]"
    >
      <span class="inline-flex items-center gap-2">
        <span :class="tacticalSectionTickClasses"></span>
        {{ sectionLabel }}
      </span>
      <NuxtLink
        :to="{ name: 'highlights' }"
        class="inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors normal-case"
      >
        See all
        <ArrowRight class="h-3 w-3" />
      </NuxtLink>
    </div>

    <div v-else-if="showHeader" class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <Film class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
        <h2
          class="font-mono text-xs uppercase tracking-[0.18em] text-foreground/80"
        >
          {{ title }}
        </h2>
      </div>
      <NuxtLink
        :to="{ name: 'highlights' }"
        class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        See all
        <ArrowRight class="h-3 w-3" />
      </NuxtLink>
    </div>

    <div v-else class="flex justify-end mb-3 -mt-1">
      <NuxtLink
        :to="{ name: 'highlights' }"
        class="inline-flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
      >
        See all
        <ArrowRight class="h-3 w-3" />
      </NuxtLink>
    </div>

    <div
      v-if="loading"
      class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      <Skeleton
        v-for="i in 4"
        :key="i"
        class="aspect-video w-full rounded-lg"
      />
    </div>

    <div v-else class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      <template v-for="item in gridItems">
        <MatchClipsGroupCard
          v-if="item.kind === 'group'"
          :key="`group-${item.matchId}`"
          :match-id="item.matchId"
          :clips="item.clips"
        />
        <HighlightCard
          v-else
          :key="`single-${item.clip.id}`"
          :clip="item.clip"
          :show-map="showMap"
        />
      </template>
    </div>
  </div>
</template>
