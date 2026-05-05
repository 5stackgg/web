<script setup lang="ts">
import { computed } from "vue";
import { Trophy, Crown, ArrowUpRight, Layers } from "lucide-vue-next";
import { Card, CardContent } from "~/components/ui/card";
import type { Clip } from "~/types/clip";

// Match-grouped highlights tile — replaces the standalone clip card
// when a match has 2+ clips. Renders like one of those broadcast
// "match recap" tiles: map poster as a backdrop, stacked thumbnail
// strip showing the included clips, and a clip count badge so the
// operator immediately reads "this is a match with N highlights" not
// "another single clip in the same scroll".
const props = defineProps<{
  matchId: string;
  clips: Clip[];
}>();

// Lead clip drives the display. Caller sorts the group newest-first
// so this surfaces the most recent matchup label / map / score.
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

// Distinct maps featured in this group's clips. A single-map match
// has length 1; a BO3 with clips on multiple maps shows the icons in
// the corner so the operator sees "clips span maps M1 + M3".
const maps = computed(() => {
  const seen = new Set<string>();
  const out: Array<{ name: string; label: string | null; poster: string | null }> = [];
  for (const c of props.clips) {
    const m = c.match_map?.map;
    if (m && !seen.has(m.name)) {
      seen.add(m.name);
      out.push({ name: m.name, label: m.label, poster: m.poster });
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
      class="relative overflow-hidden transition-all duration-200 hover:border-[hsl(var(--tac-amber)/0.6)] hover:shadow-[0_8px_32px_-12px_hsl(var(--tac-amber)/0.4)]"
    >
      <div class="relative aspect-video w-full overflow-hidden bg-black">
        <!-- Map poster backdrop. Falls back to a solid card surface
             if the lead clip has no poster. -->
        <NuxtImg
          v-if="matchMap?.map?.poster"
          :src="matchMap.map.poster"
          :alt="matchMap.map.name ?? ''"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/group-card:scale-105"
        />
        <div
          class="absolute inset-0 bg-[linear-gradient(180deg,hsl(0_0%_0%_/_0.35)_0%,hsl(0_0%_0%_/_0.55)_45%,hsl(0_0%_0%_/_0.92)_100%)]"
        ></div>

        <!-- Top-left: tournament + score chips (matches HighlightCard
             aesthetic for consistency). -->
        <div
          class="absolute top-2 left-2 flex items-center gap-1 pointer-events-none z-[2]"
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

        <!-- Top-right: clip count badge — the marquee element. Amber
             fill, oversized number, mono-track caps "highlights" so it
             reads as "this is a multi-clip group". -->
        <div
          class="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.18)] backdrop-blur-md pl-2 pr-2.5 py-1 text-[hsl(var(--tac-amber))] z-[2]"
        >
          <Layers class="h-3 w-3" />
          <span class="font-mono text-sm font-bold tabular-nums leading-none">
            {{ clips.length }}
          </span>
          <span
            class="font-mono text-[0.55rem] uppercase tracking-[0.18em] leading-none translate-y-[1px]"
          >
            highlights
          </span>
        </div>

        <!-- Center: matchup label, broadcast caption style. -->
        <div
          class="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-[1] pointer-events-none"
        >
          <h3
            v-if="matchupLabel"
            class="relative font-sans text-[clamp(1rem,2.4vw,1.6rem)] font-bold uppercase leading-[0.95] tracking-[0.02em] text-foreground drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
          >
            <span
              aria-hidden="true"
              class="absolute left-[2px] top-[2px] right-[-2px] select-none whitespace-nowrap text-transparent [-webkit-text-stroke:1px_hsl(var(--tac-amber)/0.4)]"
            >
              {{ matchupLabel }}
            </span>
            <span class="relative">{{ matchupLabel }}</span>
          </h3>
          <div
            class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-foreground/30 bg-black/40 backdrop-blur-md px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-foreground/90"
          >
            <Crown
              v-if="winningSide && (winningSide === '1' ? match?.lineup_1?.name : match?.lineup_2?.name)"
              class="h-3 w-3 text-[hsl(var(--tac-amber))]"
            />
            <span class="truncate max-w-[14ch]">
              {{
                winningSide === "1"
                  ? match?.lineup_1?.name
                  : winningSide === "2"
                    ? match?.lineup_2?.name
                    : matchMap?.map?.label ?? matchMap?.map?.name
              }}
            </span>
            <template v-if="winningSide">
              <span class="opacity-60">·</span>
              <span>Match Winner</span>
            </template>
          </div>
        </div>

      </div>

      <!-- Caption strip below the hero — completes the match identity
           with map list + a hint that this resolves to a dedicated
           page. Small font, mono-track, amber arrow on hover. -->
      <CardContent class="p-3 space-y-1">
        <div
          class="group/link flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors group-hover/group-card:text-[hsl(var(--tac-amber))]"
        >
          <span class="truncate">View match highlights</span>
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
