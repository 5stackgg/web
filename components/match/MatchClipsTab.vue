<script setup lang="ts">
import { computed, inject, type ComputedRef } from "vue";
import { Film, ArrowUpRight } from "lucide-vue-next";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import { Skeleton } from "~/components/ui/skeleton";
import type { Clip } from "~/types/clip";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Match-scoped clips view. Reads the parent-provided shared
// subscription so we don't duplicate the WS round-trip the lineup
// rows already need for the per-player clip indicators.
const props = defineProps<{
  match: {
    id: string;
    match_maps?: Array<{
      id: string;
      map?: { name?: string | null; label?: string | null } | null;
      lineup_1_score?: number | null;
      lineup_2_score?: number | null;
      winning_lineup_id?: string | null;
    }>;
    lineup_1_id?: string;
    lineup_2_id?: string;
  };
}>();

const clips = inject<ComputedRef<Clip[]>>(
  "matchClips",
  computed(() => []) as any,
);
const loading = inject<ComputedRef<boolean>>(
  "matchClipsLoading",
  computed(() => false) as any,
);

const hasClips = computed(() => clips.value.length > 0);

// Resolve match_map metadata from the prop (we already have it on
// the page) and order maps by their `order` if available — this
// surface mirrors the order the maps were played.
type MapBucket = {
  matchMapId: string;
  label: string | null;
  lineup1Score: number | null;
  lineup2Score: number | null;
  winningLineupId: string | null;
  clips: Clip[];
};

const mapBuckets = computed<MapBucket[]>(() => {
  const byMm = new Map<string, Clip[]>();
  for (const c of clips.value) {
    const id = c.match_map?.id;
    if (!id) continue;
    const list = byMm.get(id) ?? [];
    list.push(c);
    byMm.set(id, list);
  }
  const out: MapBucket[] = [];
  // Walk match_maps in order so empty maps don't render and the
  // surface stays in match order.
  for (const mm of props.match.match_maps ?? []) {
    const list = byMm.get(mm.id);
    if (!list || list.length === 0) continue;
    out.push({
      matchMapId: mm.id,
      label: mm.map?.label ?? mm.map?.name ?? null,
      lineup1Score: mm.lineup_1_score ?? null,
      lineup2Score: mm.lineup_2_score ?? null,
      winningLineupId: mm.winning_lineup_id ?? null,
      clips: list.sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
      ),
    });
  }
  return out;
});

const showPerMapSections = computed(() => mapBuckets.value.length > 1);
</script>

<template>
  <div class="max-w-[1500px] space-y-6">
    <!-- Top strip: clip count + link to the dedicated highlights page. -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <Film class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
        <h2
          class="font-mono text-xs uppercase tracking-[0.18em] text-foreground/80"
        >
          Match Highlights
        </h2>
        <span
          v-if="hasClips"
          class="rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] px-2 py-0.5 font-mono text-[0.55rem] text-[hsl(var(--tac-amber))] tracking-[0.16em]"
        >
          {{ clips.length }}
        </span>
      </div>
      <NuxtLink
        v-if="hasClips"
        :to="`/highlights/match/${match.id}`"
        class="inline-flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-[hsl(var(--tac-amber))] transition-colors"
      >
        Full recap
        <ArrowUpRight class="h-3 w-3" />
      </NuxtLink>
    </div>

    <div
      v-if="loading"
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Skeleton
        v-for="i in 4"
        :key="i"
        class="aspect-video w-full rounded-lg"
      />
    </div>

    <Empty v-else-if="!hasClips" class="min-h-[200px]">
      <EmptyTitle>No highlights yet</EmptyTitle>
      <EmptyDescription>
        Once someone clips a moment from this match, it will show up here.
      </EmptyDescription>
    </Empty>

    <div v-else-if="showPerMapSections" class="space-y-8">
      <section v-for="b in mapBuckets" :key="b.matchMapId">
        <div
          :class="[tacticalSectionLabelClasses, 'flex items-center justify-between']"
        >
          <span class="inline-flex items-center gap-2">
            <span :class="tacticalSectionTickClasses"></span>
            <span class="text-foreground">{{ b.label ?? "Map" }}</span>
            <span class="opacity-60">·</span>
            <span class="font-mono tabular-nums">
              <span
                :class="
                  b.winningLineupId === match.lineup_1_id
                    ? 'text-[hsl(var(--tac-amber))] font-semibold'
                    : ''
                "
              >
                {{ b.lineup1Score ?? "—" }}
              </span>
              <span class="opacity-60 mx-0.5">:</span>
              <span
                :class="
                  b.winningLineupId === match.lineup_2_id
                    ? 'text-[hsl(var(--tac-amber))] font-semibold'
                    : ''
                "
              >
                {{ b.lineup2Score ?? "—" }}
              </span>
            </span>
          </span>
          <span class="font-mono text-[0.6rem] tabular-nums text-muted-foreground/70">
            {{ b.clips.length }} {{ b.clips.length === 1 ? "clip" : "clips" }}
          </span>
        </div>
        <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <HighlightCard v-for="c in b.clips" :key="c.id" :clip="c" />
        </div>
      </section>
    </div>

    <div v-else class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <HighlightCard v-for="c in clips" :key="c.id" :clip="c" />
    </div>
  </div>
</template>
