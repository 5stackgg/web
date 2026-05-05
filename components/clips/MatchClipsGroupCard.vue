<script setup lang="ts">
import { computed } from "vue";
import { Trophy, Layers, ArrowUpRight } from "lucide-vue-next";
import { Card, CardContent } from "~/components/ui/card";
import type { Clip } from "~/types/clip";

// Match-grouped highlights tile — replaces the standalone clip card
// when a match has 2+ clips. Mirrors HighlightCard's layout (poster
// hero with corner chips, title + meta in CardContent below) so the
// two card types sit cohesively in the same grid. The marquee signal
// that this is a group is a single amber count badge in the corner;
// everything else is intentionally restrained.
const props = defineProps<{
  matchId: string;
  clips: Clip[];
}>();

// Lead clip drives display. Caller sorts the group newest-first.
const lead = computed(() => props.clips[0]);
const match = computed(() => lead.value.match_map?.match);
const matchMap = computed(() => lead.value.match_map);

const matchupLabel = computed(() => {
  const a = match.value?.lineup_1?.name;
  const b = match.value?.lineup_2?.name;
  if (a && b) return `${a} vs ${b}`;
  return null;
});

const score1 = computed(() => matchMap.value?.lineup_1_score);
const score2 = computed(() => matchMap.value?.lineup_2_score);
const hasScore = computed(
  () =>
    typeof score1.value === "number" &&
    typeof score2.value === "number" &&
    !(score1.value === 0 && score2.value === 0),
);
const winningSide = computed<"1" | "2" | null>(() => {
  const w = match.value?.winning_lineup_id;
  if (!w) return null;
  if (w === match.value?.lineup_1_id) return "1";
  if (w === match.value?.lineup_2_id) return "2";
  return null;
});
const isTournament = computed(
  () => match.value?.is_tournament_match === true,
);
const bestOf = computed(() => match.value?.options?.best_of ?? null);

// Distinct maps featured in this group's clips. Single-map matches
// have length 1; multi-map matches list each map name in the caption.
const maps = computed(() => {
  const seen = new Set<string>();
  const out: Array<{ name: string; label: string | null }> = [];
  for (const c of props.clips) {
    const m = c.match_map?.map;
    if (m && !seen.has(m.name)) {
      seen.add(m.name);
      out.push({ name: m.name, label: m.label });
    }
  }
  return out;
});
</script>

<template>
  <NuxtLink
    :to="`/highlights/match/${matchId}`"
    class="block group/group-card"
  >
    <Card
      class="overflow-hidden transition-all duration-200 hover:border-[hsl(var(--tac-amber)/0.5)]"
    >
      <div class="relative aspect-video w-full overflow-hidden bg-black">
        <NuxtImg
          v-if="matchMap?.map?.poster"
          :src="matchMap.map.poster"
          :alt="matchMap.map.name ?? ''"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/group-card:scale-[1.03]"
        />
        <!-- Single, gentle gradient — just enough to keep chips
             readable. Drops the heavy bottom-darken since there's no
             centered hero text fighting for legibility anymore. -->
        <div
          class="absolute inset-0 bg-[linear-gradient(180deg,hsl(0_0%_0%_/_0.4)_0%,transparent_45%,hsl(0_0%_0%_/_0.55)_100%)]"
        ></div>

        <!-- Top-left: tournament + score + BO chips. Identical
             treatment to HighlightCard so the two card types share a
             visual vocabulary in the grid. -->
        <div
          class="absolute top-2 left-2 flex items-center gap-1 pointer-events-none"
        >
          <span
            v-if="isTournament"
            class="inline-flex items-center gap-0.5 rounded bg-black/80 px-1 py-0.5 text-[0.6rem] text-[hsl(var(--tac-amber))] backdrop-blur-sm"
            title="Tournament match"
          >
            <Trophy class="h-2.5 w-2.5" />
          </span>
          <span
            v-if="hasScore"
            class="inline-flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[0.65rem] tabular-nums text-white backdrop-blur-sm"
          >
            <span :class="winningSide === '1' ? 'text-[hsl(var(--tac-amber))] font-semibold' : ''">
              {{ score1 }}
            </span>
            <span class="opacity-50">:</span>
            <span :class="winningSide === '2' ? 'text-[hsl(var(--tac-amber))] font-semibold' : ''">
              {{ score2 }}
            </span>
          </span>
          <span
            v-if="bestOf"
            class="inline-flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[0.6rem] tabular-nums text-white/90 backdrop-blur-sm"
          >
            BO{{ bestOf }}
          </span>
        </div>

        <!-- Top-right: count badge. Single visual cue that this is a
             group, not a single clip. -->
        <span
          class="absolute top-2 right-2 inline-flex items-center gap-1 rounded bg-[hsl(var(--tac-amber)/0.92)] px-1.5 py-0.5 font-mono text-[0.65rem] font-bold tabular-nums text-[hsl(var(--tac-amber-foreground))] backdrop-blur-sm shadow-sm"
          :title="`${clips.length} highlights for this match`"
        >
          <Layers class="h-2.5 w-2.5" />
          {{ clips.length }}
        </span>
      </div>

      <!-- Caption — same shape as HighlightCard. Title is the matchup
           label, sub-line shows the maps + clip count. -->
      <CardContent class="p-3 space-y-1">
        <div
          class="group/link flex items-center gap-1.5 text-sm font-medium text-foreground group-hover/group-card:text-[hsl(var(--tac-amber))] transition-colors"
          :title="matchupLabel ?? 'Match highlights'"
        >
          <span class="truncate">
            {{ matchupLabel ?? "Match highlights" }}
          </span>
          <ArrowUpRight
            class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-all group-hover/group-card:text-[hsl(var(--tac-amber))] group-hover/group-card:translate-x-0.5 group-hover/group-card:-translate-y-0.5"
          />
        </div>
        <div
          class="flex items-center justify-between gap-2 text-xs text-muted-foreground"
        >
          <span class="truncate">
            <template v-for="(m, i) in maps" :key="m.name">
              <span v-if="i > 0" class="opacity-50"> · </span>
              <span class="text-foreground/80">{{ m.label ?? m.name }}</span>
            </template>
          </span>
          <span class="shrink-0 font-mono text-[0.65rem] uppercase tracking-wider">
            {{ clips.length }} clips
          </span>
        </div>
      </CardContent>
    </Card>
  </NuxtLink>
</template>
