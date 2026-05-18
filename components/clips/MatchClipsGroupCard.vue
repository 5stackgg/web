<script setup lang="ts">
import { computed } from "vue";
import { Trophy, Film, ArrowUpRight } from "lucide-vue-next";
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

const mapNamesLabel = computed(() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of props.clips) {
    const m = c.match_map?.map;
    if (!m) continue;
    const label = m.label || (m.name ? cleanMapName(m.name) : null);
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
});

const featuredTargets = computed(() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of props.clips) {
    const name = c.target?.name;
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
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
  <NuxtLink :to="`/matches/${matchId}`" class="block h-full group/group-card">
    <Card
      class="flex h-full flex-col overflow-hidden transition-all duration-200 hover:border-[hsl(var(--tac-amber)/0.5)]"
    >
      <div class="relative aspect-video w-full overflow-hidden bg-black">
        <NuxtImg
          v-if="thumbnailSrc"
          :src="thumbnailSrc"
          :alt="matchupLabel ?? 'Match highlights'"
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
            title="Tournament match"
          >
            <Trophy class="h-2.5 w-2.5" />
          </span>
          <span v-if="bestOf" :class="pillBaseClasses">BO{{ bestOf }}</span>
        </div>

        <span
          class="absolute top-2 right-2 inline-flex h-5 items-center gap-1 rounded bg-[hsl(var(--tac-amber)/0.92)] px-1.5 font-mono text-[0.62rem] font-bold leading-none tabular-nums text-[hsl(var(--tac-amber-foreground))] shadow-sm backdrop-blur-sm"
          :title="`${clips.length} highlights for this match`"
        >
          <Film class="h-2.5 w-2.5" />
          {{ clips.length }}
        </span>

        <!-- Map list on the preview image. Single row, dot-separated,
             truncated when there are too many. -->
        <div
          v-if="perMapDisplay.length > 0"
          class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-1.5 pt-4"
        >
          <div
            class="truncate font-sans text-sm font-bold uppercase leading-tight text-white/70 drop-shadow-md"
            :title="perMapDisplay.map((mm) => mm.name).join(' · ')"
          >
            {{ perMapDisplay.map((mm) => mm.name).join(" · ") }}
          </div>
        </div>
      </div>

      <CardContent class="flex flex-1 flex-col gap-1 p-3">
        <!-- Title with winning side highlighted in amber. Tight space
             means no scoreboard pill, so colored team names carry the
             "who won" signal. -->
        <div
          class="group/link flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors"
          :title="matchupLabel ?? 'Match highlights'"
        >
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
              >
                {{ lineup1Name }}
              </span>
              <span class="mx-1 text-muted-foreground/60">vs</span>
              <span
                :class="
                  winningSide === '2'
                    ? 'font-bold text-[hsl(var(--tac-amber))]'
                    : winningSide === '1'
                      ? 'text-muted-foreground'
                      : ''
                "
              >
                {{ lineup2Name }}
              </span>
            </template>
            <template v-else>Match highlights</template>
          </span>
          <ArrowUpRight
            class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-all group-hover/group-card:translate-x-0.5 group-hover/group-card:-translate-y-0.5 group-hover/group-card:text-[hsl(var(--tac-amber))]"
          />
        </div>

        <div
          class="mt-auto flex items-end justify-between gap-2 text-xs text-muted-foreground"
        >
          <span class="min-w-0 flex-1">
            <span
              v-if="featuredTargets.length"
              class="block truncate font-semibold text-foreground/85"
              :title="featuredTargets.join(' · ')"
            >
              {{ featuredTargets.join(" · ") }}
            </span>
          </span>
          <TimeAgo
            v-if="leadCreatedAt"
            :date="leadCreatedAt"
            class="shrink-0 text-[0.65rem] text-muted-foreground/70"
          />
        </div>
      </CardContent>
    </Card>
  </NuxtLink>
</template>
