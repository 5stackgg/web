<script setup lang="ts">
import { computed } from "vue";
import { Trophy, ArrowUpRight, Crown, Calendar, Swords } from "lucide-vue-next";
import type { Clip } from "~/types/clip";

// Rich match-context card for a clip. Two layouts:
//   - "card" (default): full hero with map poster banner, scores, winner
//     highlight, status pill, link to the match page.
//   - "compact": dense matchup line + score chip + tiny "View match" link
//     suitable for popovers / sidebars.
const props = withDefaults(
  defineProps<{
    clip: Clip;
    variant?: "card" | "compact";
  }>(),
  { variant: "card" },
);

const match = computed(() => props.clip.match_map?.match ?? null);
const matchMap = computed(() => props.clip.match_map ?? null);

const lineup1 = computed(() => match.value?.lineup_1 ?? null);
const lineup2 = computed(() => match.value?.lineup_2 ?? null);

const score1 = computed(() => matchMap.value?.lineup_1_score ?? null);
const score2 = computed(() => matchMap.value?.lineup_2_score ?? null);
const hasMapScore = computed(
  () => score1.value !== null && score2.value !== null,
);

const mapWinnerId = computed(() => matchMap.value?.winning_lineup_id ?? null);
const matchWinnerId = computed(() => match.value?.winning_lineup_id ?? null);

function isMapWinner(lineupId: string | null | undefined): boolean {
  return !!lineupId && mapWinnerId.value === lineupId;
}
function isMatchWinner(lineupId: string | null | undefined): boolean {
  return !!lineupId && matchWinnerId.value === lineupId;
}

const matchStatusLabel = computed(() => {
  const s = match.value?.status;
  if (!s) return null;
  // Normalize into title case for display (Hasura enums come through
  // as PascalCase already, e.g. "Finished", "Live").
  return s;
});

const isFinished = computed(() => match.value?.status === "Finished");
const isLive = computed(() => match.value?.status === "Live");

const bestOfLabel = computed(() => {
  const bo = match.value?.options?.best_of;
  if (!bo) return null;
  return `BO${bo}`;
});

const mapName = computed(
  () => matchMap.value?.map?.label ?? matchMap.value?.map?.name ?? null,
);

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const playedDate = computed(() =>
  formatDate(match.value?.ended_at ?? match.value?.started_at ?? null),
);
</script>

<template>
  <div v-if="match && variant === 'card'" class="relative overflow-hidden rounded-lg border border-border/60 bg-card/40 [backdrop-filter:blur(6px)]">
    <!-- Map poster banner — washed out behind the content. Gradient mask
         keeps text legible regardless of poster brightness. -->
    <div v-if="matchMap?.map?.poster" class="absolute inset-0 -z-0">
      <NuxtImg
        :src="matchMap.map.poster"
        :alt="matchMap.map.name ?? ''"
        class="h-full w-full object-cover opacity-30"
      />
      <div
        class="absolute inset-0 bg-gradient-to-br from-card via-card/80 to-card/40"
      ></div>
    </div>

    <div class="relative p-4 space-y-4">
      <!-- Header row: Match label + status pill + link -->
      <div class="flex items-center gap-2">
        <Swords class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          Match Source
        </span>
        <span v-if="bestOfLabel" class="text-border">·</span>
        <span
          v-if="bestOfLabel"
          class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ bestOfLabel }}
        </span>
        <span v-if="match.is_tournament_match" class="text-border">·</span>
        <span
          v-if="match.is_tournament_match"
          class="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          <Trophy class="h-3 w-3" />
          Tournament
        </span>
        <span class="ml-auto inline-flex items-center gap-1.5">
          <span
            v-if="matchStatusLabel"
            class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em]"
            :class="
              isLive
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : isFinished
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
                  : 'border-border/60 bg-muted/30 text-muted-foreground'
            "
          >
            <span
              v-if="isLive"
              class="relative flex h-1.5 w-1.5"
            >
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"
              ></span>
              <span
                class="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive"
              ></span>
            </span>
            {{ matchStatusLabel }}
          </span>
        </span>
      </div>

      <!-- Score row — two lineup blocks with their scores between them.
           Winner gets a Crown + amber tint; loser is muted. -->
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div
          class="text-right"
          :class="
            isMapWinner(lineup1?.id)
              ? 'text-[hsl(var(--tac-amber))]'
              : isFinished && !isMapWinner(lineup1?.id)
                ? 'text-muted-foreground'
                : 'text-foreground'
          "
        >
          <div class="flex items-center justify-end gap-1.5">
            <span class="truncate font-semibold leading-tight" :title="lineup1?.name ?? ''">
              {{ lineup1?.name ?? "TBD" }}
            </span>
            <Crown
              v-if="isMatchWinner(lineup1?.id)"
              class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
            />
          </div>
          <div
            v-if="isMatchWinner(lineup1?.id)"
            class="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] mt-0.5"
          >
            Match Winner
          </div>
        </div>

        <div class="flex items-baseline gap-2">
          <span
            class="font-mono text-2xl font-bold tabular-nums leading-none"
            :class="
              hasMapScore && score1 !== null && score2 !== null
                ? score1 > score2
                  ? 'text-[hsl(var(--tac-amber))]'
                  : score1 < score2
                    ? 'text-muted-foreground'
                    : 'text-foreground'
                : 'text-muted-foreground'
            "
          >
            {{ hasMapScore ? score1 : "—" }}
          </span>
          <span class="text-sm text-muted-foreground">:</span>
          <span
            class="font-mono text-2xl font-bold tabular-nums leading-none"
            :class="
              hasMapScore && score1 !== null && score2 !== null
                ? score2 > score1
                  ? 'text-[hsl(var(--tac-amber))]'
                  : score2 < score1
                    ? 'text-muted-foreground'
                    : 'text-foreground'
                : 'text-muted-foreground'
            "
          >
            {{ hasMapScore ? score2 : "—" }}
          </span>
        </div>

        <div
          class="text-left"
          :class="
            isMapWinner(lineup2?.id)
              ? 'text-[hsl(var(--tac-amber))]'
              : isFinished && !isMapWinner(lineup2?.id)
                ? 'text-muted-foreground'
                : 'text-foreground'
          "
        >
          <div class="flex items-center gap-1.5">
            <Crown
              v-if="isMatchWinner(lineup2?.id)"
              class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            <span class="truncate font-semibold leading-tight" :title="lineup2?.name ?? ''">
              {{ lineup2?.name ?? "TBD" }}
            </span>
          </div>
          <div
            v-if="isMatchWinner(lineup2?.id)"
            class="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] mt-0.5"
          >
            Match Winner
          </div>
        </div>
      </div>

      <!-- Footer — map name, date played, link to match -->
      <div
        class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 border-t border-border/40 text-[0.65rem] font-mono uppercase tracking-[0.14em] text-muted-foreground"
      >
        <span v-if="mapName" class="text-foreground/80">{{ mapName }}</span>
        <span v-if="mapName && playedDate" class="text-border">·</span>
        <span v-if="playedDate" class="inline-flex items-center gap-1">
          <Calendar class="h-3 w-3" />
          {{ playedDate }}
        </span>
        <NuxtLink
          :to="`/matches/${match.id}`"
          class="ml-auto inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[0.6rem] tracking-[0.18em] text-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))] transition-colors"
        >
          View match
          <ArrowUpRight class="h-3 w-3" />
        </NuxtLink>
      </div>
    </div>
  </div>

  <!-- Compact variant — for popovers / tight sidebars. -->
  <div v-else-if="match && variant === 'compact'" class="space-y-2">
    <div class="flex items-center gap-2">
      <span class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
        Match
      </span>
      <span
        v-if="bestOfLabel"
        class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        · {{ bestOfLabel }}
      </span>
      <span v-if="match.is_tournament_match" class="ml-1 inline-flex items-center gap-0.5 text-[0.6rem] text-[hsl(var(--tac-amber))]">
        <Trophy class="h-2.5 w-2.5" />
      </span>
    </div>

    <div class="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
        <div class="text-right truncate" :class="isMatchWinner(lineup1?.id) ? 'text-[hsl(var(--tac-amber))] font-semibold' : 'text-foreground'">
          <span class="truncate">{{ lineup1?.name ?? "TBD" }}</span>
        </div>
        <div class="font-mono text-sm font-bold tabular-nums">
          {{ hasMapScore ? score1 : "—" }}
          <span class="text-muted-foreground mx-0.5">:</span>
          {{ hasMapScore ? score2 : "—" }}
        </div>
        <div class="text-left truncate" :class="isMatchWinner(lineup2?.id) ? 'text-[hsl(var(--tac-amber))] font-semibold' : 'text-foreground'">
          <span class="truncate">{{ lineup2?.name ?? "TBD" }}</span>
        </div>
      </div>
    </div>

    <NuxtLink
      :to="`/matches/${match.id}`"
      class="inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
    >
      View match
      <ArrowUpRight class="h-2.5 w-2.5" />
    </NuxtLink>
  </div>
</template>
