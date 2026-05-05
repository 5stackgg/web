<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  Film,
  Trophy,
  Crown,
  Calendar,
  Swords,
  ArrowUpRight,
  User,
  X,
} from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import type { Clip } from "~/types/clip";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalFilterPillClasses,
  tacticalFilterPillActiveClasses,
} from "~/utilities/tacticalClasses";

// Match-scoped highlights view. Subscribes to every clip whose
// match_map belongs to this matchId. Falls back gracefully when the
// match has zero clips (deep-link from a stale cache, deleted clips,
// etc). Sub-groups the grid by map when the match spans multiple maps
// (BO3+) so the operator sees the per-map breakdown — single-map
// matches just render a flat clips grid.
definePageMeta({
  middleware: "highlights",
});

const route = useRoute();
const router = useRouter();
const matchId = computed(() => String(route.params.matchId));

const clips = ref<Clip[]>([]);
const loading = ref(true);

// URL-driven player filter. Survives refresh + share so an operator
// can hand someone "highlights for player X in match Y".
const playerFilter = computed<string | null>(() => {
  const v = route.query.player;
  return typeof v === "string" && v.length > 0 ? v : null;
});
function setPlayerFilter(sid: string | null) {
  const next = { ...route.query } as Record<string, any>;
  if (sid) next.player = sid;
  else delete next.player;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  loading.value = true;
  if (!matchId.value) return;
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        {
          where: {
            match_map: {
              match_id: { _eq: matchId.value },
            },
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
      console.error("[match-highlights] subscription error:", err);
      loading.value = false;
    },
  });
}
watch(matchId, () => subscribe(), { immediate: true });
onBeforeUnmount(() => activeSub?.unsubscribe());

// All match-level info comes from the joined `match` on each clip —
// avoids a parallel matches_by_pk subscription. Lead clip drives.
const lead = computed<Clip | null>(() => clips.value[0] ?? null);
const match = computed(() => lead.value?.match_map?.match ?? null);

const matchupLabel = computed(() => {
  const a = match.value?.lineup_1?.name;
  const b = match.value?.lineup_2?.name;
  if (a && b) return `${a} vs ${b}`;
  return null;
});

const winningSide = computed<"1" | "2" | null>(() => {
  const w = match.value?.winning_lineup_id;
  if (!w) return null;
  if (w === match.value?.lineup_1_id) return "1";
  if (w === match.value?.lineup_2_id) return "2";
  return null;
});

const isFinished = computed(() => match.value?.status === "Finished");
const isLive = computed(() => match.value?.status === "Live");
const bestOf = computed(() => match.value?.options?.best_of ?? null);
const isTournament = computed(
  () => match.value?.is_tournament_match === true,
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

// Players available to filter on — derived from the match's clip
// targets (the people clipped, not the renderers). Sorted by name
// with a clip count next to each so the operator picks a fragger
// without guessing.
type PlayerOption = {
  steamId: string;
  name: string;
  team: "T" | "CT" | null;
  count: number;
};
const playerOptions = computed<PlayerOption[]>(() => {
  const map = new Map<string, PlayerOption>();
  for (const c of clips.value) {
    const sid = c.target_steam_id;
    if (!sid) continue;
    const existing = map.get(sid);
    if (existing) {
      existing.count += 1;
      continue;
    }
    map.set(sid, {
      steamId: sid,
      name: c.target?.name ?? `#${sid.slice(-4)}`,
      // Match_clips don't carry the target's CT/T side — leave null
      // and let the picker render without a colored chip.
      team: null,
      count: 1,
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
});

const playerFilterName = computed<string | null>(() => {
  const sid = playerFilter.value;
  if (!sid) return null;
  return playerOptions.value.find((p) => p.steamId === sid)?.name ?? null;
});

// Filtered clip list — the player filter narrows BOTH the per-map
// sub-sections AND the flat fallback grid below.
const filteredClips = computed(() => {
  if (!playerFilter.value) return clips.value;
  return clips.value.filter((c) => c.target_steam_id === playerFilter.value);
});

// Group clips by match_map. When the match has multiple maps, render
// sub-sections per map; single-map matches collapse to one grid.
type MapGroup = {
  matchMapId: string;
  mapName: string | null;
  mapLabel: string | null;
  poster: string | null;
  lineup1Score: number | null;
  lineup2Score: number | null;
  winningLineupId: string | null;
  clips: Clip[];
};
const mapGroups = computed<MapGroup[]>(() => {
  const map = new Map<string, MapGroup>();
  for (const c of filteredClips.value) {
    const mm = c.match_map;
    if (!mm) continue;
    const id = mm.id;
    let g = map.get(id);
    if (!g) {
      g = {
        matchMapId: id,
        mapName: mm.map?.name ?? null,
        mapLabel: mm.map?.label ?? null,
        poster: mm.map?.poster ?? null,
        lineup1Score: mm.lineup_1_score ?? null,
        lineup2Score: mm.lineup_2_score ?? null,
        winningLineupId: mm.winning_lineup_id ?? null,
        clips: [],
      };
      map.set(id, g);
    }
    g.clips.push(c);
  }
  // Sort each group's clips newest-first and the groups themselves by
  // newest-clip-within. That keeps the most recent maps at the top
  // when a series is played in order.
  for (const g of map.values()) {
    g.clips.sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
    );
  }
  return Array.from(map.values()).sort((a, b) =>
    a.clips[0].created_at < b.clips[0].created_at ? 1 : -1,
  );
});

const showPerMapSections = computed(() => mapGroups.value.length > 1);
</script>

<template>
  <!-- Breadcrumb / back link — replaces page chrome that doesn't
       exist on this dedicated route. Sits above the header so it
       doesn't fight the corner-bracket motif of TacticalPageHeader. -->
  <PageTransition>
    <div class="mb-4 flex items-center gap-2">
      <Button variant="ghost" size="sm" as-child>
        <NuxtLink
          to="/highlights"
          class="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em]"
        >
          <ArrowLeft class="h-3.5 w-3.5" />
          All Highlights
        </NuxtLink>
      </Button>
    </div>
  </PageTransition>

  <PageTransition v-if="loading">
    <div
      class="rounded-lg border border-border/60 bg-card/30 [backdrop-filter:blur(6px)] p-6 space-y-4"
    >
      <Skeleton class="h-8 w-2/3" />
      <Skeleton class="h-5 w-1/3" />
      <Skeleton class="h-32 w-full" />
    </div>
  </PageTransition>

  <PageTransition v-else-if="!clips.length">
    <Empty>
      <EmptyTitle>No clips for this match</EmptyTitle>
      <EmptyDescription>
        Either no highlights have been rendered yet, or the clips have been
        removed.
      </EmptyDescription>
      <Button as-child variant="outline" class="mt-4">
        <NuxtLink to="/highlights">Back to highlights</NuxtLink>
      </Button>
    </Empty>
  </PageTransition>

  <template v-else>
    <!-- Hero — match recap card that spans the page. Map poster as
         backdrop, scores typeset broadcast-style, winner crowned. The
         visual language extends the modal's caption strip + match
         summary into a full-page banner. -->
    <PageTransition :delay="40">
      <header
        class="relative overflow-hidden rounded-lg border border-border bg-card/40 [backdrop-filter:blur(6px)]"
      >
        <NuxtImg
          v-if="lead?.match_map?.map?.poster"
          :src="lead.match_map.map.poster"
          :alt="lead.match_map.map.name ?? ''"
          class="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div
          class="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--card)/0.5)_0%,hsl(var(--card)/0.85)_60%,hsl(var(--card))_100%)]"
        ></div>

        <!-- Four-corner brackets — same motif as TacticalPageHeader and
             the clip modal. Anchors this page in the same system. -->
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-2 top-2 h-[14px] w-[14px] border-l-2 border-t-2 border-[hsl(var(--tac-amber))] z-10"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute right-2 top-2 h-[14px] w-[14px] border-r-2 border-t-2 border-[hsl(var(--tac-amber))] z-10"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-2 bottom-2 h-[14px] w-[14px] border-l-2 border-b-2 border-[hsl(var(--tac-amber))] z-10"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute right-2 bottom-2 h-[14px] w-[14px] border-r-2 border-b-2 border-[hsl(var(--tac-amber))] z-10"
        ></span>

        <div class="relative px-5 sm:px-7 py-6 sm:py-8 space-y-5">
          <!-- Eyebrow row: section label + match status pill + clip count. -->
          <div class="flex flex-wrap items-center gap-3">
            <span
              class="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground"
            >
              <span class="text-[hsl(var(--tac-amber))]">◢</span>
              Match Recap
            </span>
            <span
              v-if="bestOf"
              class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              · BO{{ bestOf }}
            </span>
            <span
              v-if="isTournament"
              class="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
            >
              <Trophy class="h-3 w-3" />
              Tournament
            </span>
            <span class="ml-auto flex items-center gap-2">
              <span
                v-if="isLive"
                class="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-destructive"
              >
                <span class="relative flex h-1.5 w-1.5">
                  <span
                    class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"
                  ></span>
                  <span
                    class="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive"
                  ></span>
                </span>
                Live
              </span>
              <span
                v-else-if="isFinished"
                class="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-emerald-400"
              >
                Finished
              </span>
              <span
                class="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.15)] px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
              >
                <Film class="h-3 w-3" />
                {{ clips.length }} {{ clips.length === 1 ? "clip" : "clips" }}
              </span>
            </span>
          </div>

          <!-- Title block — broadcast-style "TEAM A vs TEAM B" -->
          <div v-if="matchupLabel" class="flex items-center gap-3">
            <Swords class="h-6 w-6 shrink-0 text-[hsl(var(--tac-amber))]" />
            <h1
              class="relative m-0 font-sans text-[clamp(1.5rem,3.5vw,2.75rem)] font-bold uppercase leading-[0.95] tracking-[0.02em] [font-stretch:85%]"
            >
              <span
                aria-hidden="true"
                class="pointer-events-none absolute left-[4px] top-[4px] right-[-4px] select-none whitespace-nowrap text-transparent [-webkit-text-stroke:1px_hsl(var(--tac-amber)/0.35)]"
              >
                {{ matchupLabel }}
              </span>
              <span
                class="relative bg-[linear-gradient(180deg,hsl(var(--foreground))_0%,hsl(var(--foreground)/0.7)_100%)] bg-clip-text text-transparent"
              >
                {{ matchupLabel }}
              </span>
            </h1>
          </div>

          <!-- Series score — sums per-map scores across all maps in this
               match. Shows the overall outcome at a glance, with the
               crown decorating the match-winner side. -->
          <div
            class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6 max-w-3xl"
          >
            <div class="text-right min-w-0">
              <div class="flex items-center justify-end gap-2">
                <span
                  class="truncate font-semibold text-base sm:text-lg"
                  :title="match?.lineup_1?.name ?? ''"
                  :class="
                    winningSide === '1'
                      ? 'text-[hsl(var(--tac-amber))]'
                      : isFinished
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                  "
                >
                  {{ match?.lineup_1?.name ?? "TBD" }}
                </span>
                <Crown
                  v-if="winningSide === '1'"
                  class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
                />
              </div>
            </div>

            <div class="flex items-baseline gap-2 sm:gap-3 px-2">
              <span
                class="font-mono text-3xl sm:text-5xl font-bold tabular-nums leading-none"
                :class="
                  winningSide === '1'
                    ? 'text-[hsl(var(--tac-amber))]'
                    : winningSide === '2'
                      ? 'text-muted-foreground'
                      : 'text-foreground'
                "
              >
                {{
                  mapGroups.filter(
                    (g) =>
                      g.winningLineupId &&
                      g.winningLineupId === match?.lineup_1_id,
                  ).length
                }}
              </span>
              <span class="text-base sm:text-xl text-muted-foreground">:</span>
              <span
                class="font-mono text-3xl sm:text-5xl font-bold tabular-nums leading-none"
                :class="
                  winningSide === '2'
                    ? 'text-[hsl(var(--tac-amber))]'
                    : winningSide === '1'
                      ? 'text-muted-foreground'
                      : 'text-foreground'
                "
              >
                {{
                  mapGroups.filter(
                    (g) =>
                      g.winningLineupId &&
                      g.winningLineupId === match?.lineup_2_id,
                  ).length
                }}
              </span>
            </div>

            <div class="text-left min-w-0">
              <div class="flex items-center gap-2">
                <Crown
                  v-if="winningSide === '2'"
                  class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
                />
                <span
                  class="truncate font-semibold text-base sm:text-lg"
                  :title="match?.lineup_2?.name ?? ''"
                  :class="
                    winningSide === '2'
                      ? 'text-[hsl(var(--tac-amber))]'
                      : isFinished
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                  "
                >
                  {{ match?.lineup_2?.name ?? "TBD" }}
                </span>
              </div>
            </div>
          </div>

          <!-- Footer meta + link to full match page. -->
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 border-t border-border/40 text-[0.65rem] font-mono uppercase tracking-[0.14em] text-muted-foreground"
          >
            <span v-if="playedDate" class="inline-flex items-center gap-1">
              <Calendar class="h-3 w-3" />
              {{ playedDate }}
            </span>
            <span v-if="mapGroups.length">
              <span v-if="playedDate" class="text-border">·</span>
              {{ mapGroups.length }}
              {{ mapGroups.length === 1 ? "map" : "maps" }}
            </span>
            <NuxtLink
              v-if="match?.id"
              :to="`/matches/${match.id}`"
              class="ml-auto inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[0.6rem] tracking-[0.18em] text-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))] transition-colors"
            >
              View match
              <ArrowUpRight class="h-3 w-3" />
            </NuxtLink>
          </div>
        </div>
      </header>
    </PageTransition>

    <!-- Player filter toolbar. URL-driven (?player=<sid>) so links
         survive. Shows a select pre-populated with every player who
         has at least one clip in this match, plus a chip + result
         count when a filter is active. -->
    <PageTransition v-if="playerOptions.length > 1" :delay="60" class="mt-4">
      <div class="flex flex-wrap items-center gap-2">
        <Select
          :model-value="playerFilter ?? '__all__'"
          @update:model-value="
            (v) => setPlayerFilter(v === '__all__' ? null : (v as string))
          "
        >
          <SelectTrigger
            class="h-8 w-auto min-w-[12rem] gap-2 rounded-full border-border/60 bg-muted/30 px-3 text-xs"
          >
            <User class="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel
                class="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                Filter by Player
              </SelectLabel>
              <SelectItem value="__all__">
                All players ({{ clips.length }})
              </SelectItem>
              <SelectItem
                v-for="p in playerOptions"
                :key="p.steamId"
                :value="p.steamId"
              >
                {{ p.name }} ({{ p.count }})
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <button
          v-if="playerFilter"
          type="button"
          :class="[
            tacticalFilterPillClasses,
            tacticalFilterPillActiveClasses,
          ]"
          @click="setPlayerFilter(null)"
        >
          <User class="h-3 w-3" />
          <span class="truncate max-w-[10rem]">
            {{ playerFilterName ?? "Player" }}
          </span>
          <X class="h-3 w-3 opacity-70" />
        </button>

        <span
          class="ml-auto font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground tabular-nums"
        >
          {{ filteredClips.length }}
          {{ filteredClips.length === 1 ? "clip" : "clips" }}
        </span>
      </div>
    </PageTransition>

    <!-- Per-map sections — one block per map for multi-map matches.
         Each section gets its own label with the map's score so the
         operator reads the series flow without leaving this page. -->
    <PageTransition v-if="showPerMapSections" :delay="80" class="mt-6">
      <div class="space-y-8">
        <section v-for="g in mapGroups" :key="g.matchMapId">
          <div
            :class="[tacticalSectionLabelClasses, 'flex items-center justify-between']"
          >
            <span class="inline-flex items-center gap-2">
              <span :class="tacticalSectionTickClasses"></span>
              <span class="text-foreground">
                {{ g.mapLabel ?? g.mapName }}
              </span>
              <span class="opacity-60">·</span>
              <span class="font-mono tabular-nums">
                <span
                  :class="
                    g.winningLineupId === match?.lineup_1_id
                      ? 'text-[hsl(var(--tac-amber))] font-semibold'
                      : ''
                  "
                >
                  {{ g.lineup1Score ?? "—" }}
                </span>
                <span class="opacity-60 mx-0.5">:</span>
                <span
                  :class="
                    g.winningLineupId === match?.lineup_2_id
                      ? 'text-[hsl(var(--tac-amber))] font-semibold'
                      : ''
                  "
                >
                  {{ g.lineup2Score ?? "—" }}
                </span>
              </span>
            </span>
            <span class="font-mono text-[0.6rem] tabular-nums text-muted-foreground/70">
              {{ g.clips.length }} {{ g.clips.length === 1 ? "clip" : "clips" }}
            </span>
          </div>
          <div
            class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <HighlightCard
              v-for="c in g.clips"
              :key="c.id"
              :clip="c"
            />
          </div>
        </section>
      </div>
    </PageTransition>

    <!-- Single-map match — flat clips grid, no sub-sections. -->
    <PageTransition v-else :delay="80" class="mt-6">
      <Empty v-if="!filteredClips.length" class="min-h-[160px]">
        <EmptyTitle>No highlights for this player</EmptyTitle>
        <EmptyDescription>
          Try a different player or clear the filter to see every clip in
          this match.
        </EmptyDescription>
        <Button
          variant="outline"
          size="sm"
          class="mt-3"
          @click="setPlayerFilter(null)"
        >
          Clear filter
        </Button>
      </Empty>
      <div
        v-else
        class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <HighlightCard
          v-for="c in filteredClips"
          :key="c.id"
          :clip="c"
        />
      </div>
    </PageTransition>
  </template>
</template>
