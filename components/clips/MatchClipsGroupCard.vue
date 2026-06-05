<script setup lang="ts">
import { computed } from "vue";
import { Trophy, Film, ArrowUpRight, Clock } from "lucide-vue-next";
import { Card, CardContent } from "~/components/ui/card";
import TimeAgo from "~/components/TimeAgo.vue";
import cleanMapName from "~/utilities/cleanMapName";
import type { Clip } from "~/types/clip";

const props = defineProps<{
  matchId: string;
  clips: Clip[];
}>();

// Caller sorts the group newest-first.
const lead = computed(() => props.clips[0]);
const match = computed(() => lead.value.match_map?.match);
const leadMap = computed(() => lead.value.match_map);

const lineup1Name = computed(() => match.value?.lineup_1?.name ?? null);
const lineup2Name = computed(() => match.value?.lineup_2?.name ?? null);
const matchupLabel = computed(() => {
  if (lineup1Name.value && lineup2Name.value) {
    return `${lineup1Name.value} vs ${lineup2Name.value}`;
  }
  return null;
});
const winningSide = computed<"1" | "2" | null>(() => {
  const w = match.value?.winning_lineup_id;
  if (!w) return null;
  if (w === match.value?.lineup_1_id) return "1";
  if (w === match.value?.lineup_2_id) return "2";
  return null;
});

const isTournament = computed(() => match.value?.is_tournament_match === true);
const bestOf = computed(() => match.value?.options?.best_of ?? null);

// All maps played, sorted by play order. Falls back to the lead clip's
// map when match.match_maps isn't on the payload yet.
const playedMaps = computed(() => {
  const list = (match.value?.match_maps || []).filter(
    (mm: any) =>
      typeof mm.lineup_1_score === "number" &&
      typeof mm.lineup_2_score === "number" &&
      !(mm.lineup_1_score === 0 && mm.lineup_2_score === 0),
  );
  if (list.length > 0) {
    return [...list].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }
  // Fallback path — single map from lead clip
  if (
    leadMap.value &&
    typeof leadMap.value.lineup_1_score === "number" &&
    typeof leadMap.value.lineup_2_score === "number" &&
    !(leadMap.value.lineup_1_score === 0 && leadMap.value.lineup_2_score === 0)
  ) {
    return [leadMap.value];
  }
  return [];
});

const isMultiMap = computed(() => playedMaps.value.length > 1);

const perMapDisplay = computed(() => {
  const lineup1Id = match.value?.lineup_1_id;
  const lineup2Id = match.value?.lineup_2_id;
  return playedMaps.value.map((mm: any) => ({
    id: mm.id,
    name: mm.map?.label || (mm.map?.name ? cleanMapName(mm.map.name) : ""),
    score1: mm.lineup_1_score ?? 0,
    score2: mm.lineup_2_score ?? 0,
    winningSide:
      mm.winning_lineup_id === lineup1Id
        ? ("1" as const)
        : mm.winning_lineup_id === lineup2Id
          ? ("2" as const)
          : null,
  }));
});

// Prefer the first clip's thumbnail (real action shot) over the map poster.
const thumbnailSrc = computed(() => {
  for (const c of props.clips) {
    if (c.thumbnail_download_url) return c.thumbnail_download_url;
  }
  return leadMap.value?.map?.poster ?? null;
});

const leadCreatedAt = computed(() => lead.value?.created_at ?? null);

// Consistent pill chrome — same padding, leading, and font size for all
// top-left badges so trophy/score/BO line up flush.
const pillBaseClasses =
  "inline-flex h-5 items-center gap-1 rounded bg-black/80 px-1.5 font-mono text-[0.62rem] leading-none tabular-nums text-white/90 backdrop-blur-sm";
</script>

<template>
  <NuxtLink :to="`/matches/${matchId}`" class="block group/group-card">
    <Card
      class="flex flex-col overflow-hidden transition-all duration-200 hover:border-[hsl(var(--tac-amber)/0.5)]"
    >
      <div class="relative aspect-video w-full overflow-hidden bg-black">
        <NuxtImg
          v-if="thumbnailSrc"
          :src="thumbnailSrc"
          :alt="matchupLabel ?? $t('ui_extras.match_highlights_alt')"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/group-card:scale-[1.03]"
        />
        <div
          class="absolute inset-0 bg-[linear-gradient(180deg,hsl(0_0%_0%_/_0.4)_0%,transparent_45%,hsl(0_0%_0%_/_0.55)_100%)]"
        ></div>

        <div
          class="pointer-events-none absolute top-2 left-2 flex items-center gap-1"
        >
          <span
            v-if="isTournament"
            :class="[pillBaseClasses, 'text-[hsl(var(--tac-amber))]']"
            :title="$t('ui.tournament_match')"
          >
            <Trophy class="h-2.5 w-2.5" />
          </span>
          <span v-if="bestOf" :class="pillBaseClasses">BO{{ bestOf }}</span>
        </div>

        <span
          class="absolute top-2 right-2 inline-flex h-5 items-center gap-1 rounded bg-[hsl(var(--tac-amber)/0.92)] px-1.5 font-mono text-[0.62rem] font-bold leading-none tabular-nums text-[hsl(var(--tac-amber-foreground))] shadow-sm backdrop-blur-sm"
          :title="
            $t('ui_extras.match_highlights_for_count', { count: clips.length })
          "
        >
          <Film class="h-2.5 w-2.5" />
          {{ clips.length }}
        </span>

        <!-- Frame footer: maps anchored left, timestamp on the opposite side
             so the bottom half is free for the matchup. -->
        <div
          v-if="perMapDisplay.length > 0 || leadCreatedAt"
          class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-1.5 pt-4"
        >
          <div
            v-if="perMapDisplay.length > 0"
            class="min-w-0 truncate font-sans text-sm font-bold uppercase leading-tight text-white/70 drop-shadow-md"
            :title="perMapDisplay.map((mm) => mm.name).join(' · ')"
          >
            {{ perMapDisplay.map((mm) => mm.name).join(" · ") }}
          </div>
          <span
            v-if="leadCreatedAt"
            class="ml-auto flex shrink-0 items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-white/55 drop-shadow-md"
          >
            <Clock class="h-3 w-3" />
            <TimeAgo :date="leadCreatedAt" hide-icon />
          </span>
        </div>
      </div>

      <CardContent class="p-0 sm:p-0">
        <!-- Matchup: lineup names with the winning side in amber. Works for
             team-vs-team, team-vs-pug, and pug-vs-pug alike. -->
        <div
          class="group/link flex items-center gap-2 px-2.5 py-2 text-sm font-semibold leading-snug text-foreground"
          :title="matchupLabel ?? $t('ui_extras.match_highlights_alt')"
        >
          <span
            class="h-3 w-[2px] shrink-0 rounded-full bg-[hsl(var(--tac-amber))]"
            aria-hidden="true"
          ></span>
          <span class="min-w-0 flex-1 truncate">
            <template v-if="lineup1Name && lineup2Name">
              <span
                :class="
                  winningSide === '1'
                    ? 'font-bold text-[hsl(var(--tac-amber))]'
                    : winningSide === '2'
                      ? 'text-muted-foreground'
                      : ''
                "
                >{{ lineup1Name }}</span
              >
              <span class="mx-1 text-muted-foreground/50">vs</span>
              <span
                :class="
                  winningSide === '2'
                    ? 'font-bold text-[hsl(var(--tac-amber))]'
                    : winningSide === '1'
                      ? 'text-muted-foreground'
                      : ''
                "
                >{{ lineup2Name }}</span
              >
            </template>
            <template v-else>{{
              $t("ui_extras.match_highlights_alt")
            }}</template>
          </span>
          <ArrowUpRight
            class="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-all group-hover/group-card:-translate-y-0.5 group-hover/group-card:translate-x-0.5 group-hover/group-card:text-[hsl(var(--tac-amber))]"
          />
        </div>
      </CardContent>
    </Card>
  </NuxtLink>
</template>
