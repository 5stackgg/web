<script setup lang="ts">
import { computed, ref } from "vue";
import { Film, ArrowRight } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import { order_by, $ } from "~/generated/zeus";
import { Skeleton } from "~/components/ui/skeleton";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import MatchClipsGroupCard from "~/components/clips/MatchClipsGroupCard.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";

const scrollRef = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);
import type { Clip } from "~/types/clip";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = withDefaults(
  defineProps<{
    limit?: number;
    title?: string;
    showHeader?: boolean;
    sectionLabel?: string;
    horizontal?: boolean;
  }>(),
  {
    limit: 8,
    title: "Recent Highlights",
    showHeader: true,
    horizontal: false,
  },
);

// Over-fetched so we can dedupe to one card per match (a Bo3+ contributes
// up to one match_map per map). LEAD_POOL is the base, extendedPool
// grows as the user approaches the right edge.
const LEAD_POOL_BASE = Math.max(40, props.limit * 4);
const extendedPool = ref(LEAD_POOL_BASE);
const reachedEnd = ref(false);
const inFlight = ref(false);

type MatchMapRow = {
  id: string;
  match?: { id: string } | null;
  match_clips: Clip[];
};

const matchMaps = ref<MatchMapRow[]>([]);
const loading = ref(true);

async function fetchData() {
  if (matchMaps.value.length === 0) {
    loading.value = true;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        match_maps: [
          {
            where: { public_clips_count: { _gt: 0 } },
            order_by: $("groups_order_by", "[match_maps_order_by!]!"),
            limit: $("pool_size", "Int!"),
          } as any,
          {
            id: true,
            match: { id: true },
            match_clips: [
              {
                where: { visibility: { _eq: "public" } },
                order_by: $("clips_order_by", "[match_clips_order_by!]!"),
              },
              matchClipFields,
            ],
          },
        ],
      } as any),
      variables: {
        groups_order_by: [{ public_latest_clip_at: order_by.desc }],
        clips_order_by: [{ created_at: order_by.desc }],
        pool_size: extendedPool.value,
      },
      fetchPolicy: "network-only",
    });
    matchMaps.value = ((data as any)?.match_maps ?? []) as MatchMapRow[];
    reachedEnd.value = matchMaps.value.length < extendedPool.value;
  } catch (err) {
    console.error("[recent-highlights] fetch error:", err);
  } finally {
    loading.value = false;
    inFlight.value = false;
  }
}

async function loadMore() {
  if (reachedEnd.value || inFlight.value) return;
  inFlight.value = true;
  extendedPool.value += LEAD_POOL_BASE;
  await fetchData();
}

fetchData();

const hasClips = computed(() =>
  matchMaps.value.some((mm) => (mm.match_clips?.length ?? 0) > 0),
);

// With sectionLabel, a flash of header + skeleton that then vanishes is
// worse than one beat of nothing.
const shouldRender = computed(() =>
  props.sectionLabel ? hasClips.value : loading.value || hasClips.value,
);

type GridItem =
  | { kind: "single"; clip: Clip; sortKey: string }
  | { kind: "group"; matchId: string; clips: Clip[]; sortKey: string };
const gridItems = computed<GridItem[]>(() => {
  const byMatch = new Map<string, Clip[]>();
  const orphans: Clip[] = [];
  for (const mm of matchMaps.value) {
    const matchId = mm.match?.id;
    const clips = mm.match_clips ?? [];
    if (!matchId) {
      orphans.push(...clips);
      continue;
    }
    const list = byMatch.get(matchId) ?? [];
    list.push(...clips);
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
  // Display cap scales with extendedPool so load-more reveals more
  // grouped cards alongside its over-fetched pool.
  const displayLimit = Math.max(
    props.limit,
    Math.round((extendedPool.value / LEAD_POOL_BASE) * props.limit),
  );
  return items.slice(0, displayLimit);
});
</script>

<template>
  <div v-show="shouldRender">
    <div
      v-if="sectionLabel"
      :class="[
        tacticalSectionLabelClasses,
        '!flex w-full items-center justify-between',
      ]"
    >
      <div class="inline-flex items-center gap-3">
        <span class="inline-flex items-center gap-2">
          <span :class="tacticalSectionTickClasses"></span>
          {{ sectionLabel }}
        </span>
        <NuxtLink
          :to="{ name: 'highlights' }"
          class="inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors normal-case"
        >
          {{ $t("common.see_all") }}
          <ArrowRight class="h-3 w-3" />
        </NuxtLink>
      </div>
      <ScrollArrows
        v-if="horizontal"
        :can-left="scrollRef?.state?.canScrollLeft"
        :can-right="scrollRef?.state?.canScrollRight || !reachedEnd"
        @scroll="
          (d) => {
            scrollRef?.scrollByDirection(d);
            if (d === 'right') loadMore();
          }
        "
      />
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
        {{ $t("common.see_all") }}
        <ArrowRight class="h-3 w-3" />
      </NuxtLink>
    </div>

    <div v-else class="flex justify-end mb-3 -mt-1">
      <NuxtLink
        :to="{ name: 'highlights' }"
        class="inline-flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
      >
        {{ $t("common.see_all") }}
        <ArrowRight class="h-3 w-3" />
      </NuxtLink>
    </div>

    <HorizontalScrollRow v-if="loading && horizontal" ref="scrollRef">
      <Skeleton
        v-for="i in 4"
        :key="i"
        class="aspect-video w-[85vw] shrink-0 rounded-lg sm:w-72"
      />
    </HorizontalScrollRow>

    <div
      v-else-if="loading"
      class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      <Skeleton
        v-for="i in 4"
        :key="i"
        class="aspect-video w-full rounded-lg"
      />
    </div>

    <HorizontalScrollRow
      v-else-if="horizontal"
      ref="scrollRef"
      @approaching-end="loadMore"
    >
      <template v-for="item in gridItems">
        <MatchClipsGroupCard
          v-if="item.kind === 'group'"
          :key="`group-${item.matchId}`"
          :match-id="item.matchId"
          :clips="item.clips"
          class="w-[85vw] shrink-0 snap-start sm:w-72"
        />
        <HighlightCard
          v-else
          :key="`single-${item.clip.id}`"
          :clip="item.clip"
          class="w-[85vw] shrink-0 snap-start sm:w-72"
        />
      </template>
    </HorizontalScrollRow>

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
        />
      </template>
    </div>
  </div>
</template>
