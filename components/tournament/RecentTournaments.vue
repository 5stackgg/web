<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowRight } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";
import { excludeLeagueTournaments } from "~/graphql/tournamentFilters";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from "~/components/ui/dialog";
import TournamentCard from "~/components/tournament/TournamentCard.vue";
import type { TournamentCardVariant } from "~/components/tournament/tournamentCard";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";
import {
  tacticalSectionDescriptionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const scrollRef = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);

type StatusVariant = "finished" | "live" | "registration" | "default";

const props = withDefaults(
  defineProps<{
    limit?: number;
    sectionLabel?: string;
    sectionDescription?: string;
    statuses?: e_tournament_status_enum[];
    statusVariant?: StatusVariant;
    statusLabel?: string;
    orderDirection?: "asc" | "desc";
    compact?: boolean;
    // Which card to render. Falls back to `compact` for callers that predate
    // this prop.
    card?: TournamentCardVariant;
    horizontal?: boolean;
    hideWhenEmpty?: boolean;
    emptyLabel?: string;
    emptyDescription?: string;
    // When set, only return tournaments whose roster contains this player.
    playerSteamId?: string | number | null;
    // Override the "See all" destination. Pass null to hide the link
    // (useful when this component is rendered on /tournaments itself).
    seeAllTo?: string | Record<string, any> | null;
    // Open the full list in a dialog instead of navigating to `seeAllTo` —
    // for sections whose filters (a single player's tournaments) have no
    // equivalent on the destination page.
    seeAllAsModal?: boolean;
  }>(),
  {
    limit: 8,
    sectionLabel: "RECENT.TOURNAMENTS",
    sectionDescription: "",
    statuses: () => [e_tournament_status_enum.Finished],
    statusVariant: "finished",
    statusLabel: undefined,
    orderDirection: "desc",
    compact: false,
    card: undefined,
    horizontal: false,
    hideWhenEmpty: false,
    emptyLabel: "",
    emptyDescription: "",
    playerSteamId: null,
    seeAllTo: "/tournaments",
    seeAllAsModal: false,
  },
);

const cardVariant = computed<TournamentCardVariant>(
  () => props.card ?? (props.compact ? "compact" : "feature"),
);

const emit = defineEmits<{ loaded: [count: number] }>();

const tournaments = ref<any[]>([]);
const loading = ref(true);

// Load-more pattern — extendedLimit grows when the user approaches
// the right edge so the next batch is ready before they get there.
const extendedLimit = ref(props.limit);
const reachedEnd = ref(false);
const inFlight = ref(false);

async function fetchTournaments(limit: number): Promise<any[]> {
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      tournaments: [
        {
          where: $("where", "tournaments_bool_exp!"),
          order_by: $("order_by", "[tournaments_order_by!]!"),
          limit: $("limit", "Int!"),
        } as any,
        {
          ...simpleTournamentFields,
          awards: [
            { where: { placement: { _in: [1, 2, 3] } } } as any,
            {
              id: true,
              placement: true,
              tournament_team_id: true,
              award: {
                id: true,
                name: true,
                tier: true,
                silhouette: true,
                image_url: true,
              },
              tournament_team: {
                id: true,
                name: true,
                team: { name: true, short_name: true },
              },
            },
          ],
          stages: [
            { order_by: [{ order: order_by.asc }] } as any,
            {
              id: true,
              type: true,
              order: true,
              groups: true,
              default_best_of: true,
              third_place_match: true,
              options: matchOptionsFields,
              e_tournament_stage_type: { description: true },
              results: [
                {} as any,
                {
                  tournament_team_id: true,
                  rank: true,
                  placement: true,
                  team: {
                    id: true,
                    name: true,
                    team: { name: true, short_name: true },
                  },
                },
              ],
            },
          ],
          ...(props.playerSteamId
            ? {
                rosters: [
                  {
                    where: {
                      player_steam_id: {
                        _eq: String(props.playerSteamId),
                      },
                    },
                    limit: 1,
                  } as any,
                  { tournament_team_id: true },
                ],
              }
            : {}),
        },
      ],
    } as any),
    variables: {
      where: excludeLeagueTournaments({
        status: { _in: props.statuses },
        ...(props.playerSteamId
          ? {
              rosters: {
                player_steam_id: { _eq: String(props.playerSteamId) },
              },
            }
          : {}),
      }),
      order_by: [
        {
          start: props.orderDirection === "asc" ? order_by.asc : order_by.desc,
        },
      ],
      limit,
    },
    fetchPolicy: "network-only",
  });

  return ((data as any)?.tournaments ?? []) as any[];
}

async function fetchData() {
  if (tournaments.value.length === 0) loading.value = true;
  try {
    tournaments.value = await fetchTournaments(extendedLimit.value);
    // Heuristic — fewer rows than requested = we've hit the end.
    reachedEnd.value = tournaments.value.length < extendedLimit.value;
  } catch (err) {
    console.error("[recent-tournaments] fetch error:", err);
  } finally {
    loading.value = false;
    inFlight.value = false;
    emit("loaded", tournaments.value.length);
  }
}

async function loadMore() {
  if (reachedEnd.value || inFlight.value) return;
  inFlight.value = true;
  extendedLimit.value += props.limit;
  await fetchData();
}

fetchData();

// The "see all" dialog re-runs the same query without the row's display
// limit, so it can show the whole filtered set rather than dropping the
// filters on the floor by navigating to /tournaments.
const SEE_ALL_LIMIT = 60;

const seeAllOpen = ref(false);
const seeAllTournaments = ref<any[]>([]);
const seeAllLoading = ref(false);

watch(
  () => [
    props.statuses,
    props.orderDirection,
    props.limit,
    props.playerSteamId,
  ],
  () => {
    // Reset paging state when filter inputs change.
    extendedLimit.value = props.limit;
    reachedEnd.value = false;
    seeAllTournaments.value = [];
    fetchData();
  },
  { deep: true },
);

async function openSeeAll() {
  seeAllOpen.value = true;
  if (seeAllTournaments.value.length > 0) {
    return;
  }

  seeAllLoading.value = true;
  try {
    seeAllTournaments.value = await fetchTournaments(SEE_ALL_LIMIT);
  } catch (err) {
    console.error("[recent-tournaments] see-all fetch error:", err);
  } finally {
    seeAllLoading.value = false;
  }
}

// The simple card is a fixed 320px tile, so it wraps rather than stretching
// into a grid track.
const seeAllLayoutClasses = computed(() => {
  if (cardVariant.value === "simple") {
    return "flex flex-wrap justify-center gap-3";
  }
  if (cardVariant.value === "compact") {
    return "grid gap-3 sm:grid-cols-2";
  }
  return "space-y-4";
});

const hasTournaments = computed(() => tournaments.value.length > 0);
// Hide-when-empty sections stay hidden during loading to avoid the
// skeleton → collapse jitter — they only push content down when they
// actually have something to show.
const shouldRender = computed(() => {
  if (props.hideWhenEmpty) {
    return hasTournaments.value;
  }
  return true;
});
</script>

<template>
  <div v-show="shouldRender">
    <div
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
        <button
          v-if="seeAllAsModal"
          type="button"
          class="inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors normal-case"
          @click="openSeeAll"
        >
          {{ $t("tournament.recent.see_all") }}
          <ArrowRight class="h-3 w-3" />
        </button>
        <NuxtLink
          v-else-if="seeAllTo"
          :to="seeAllTo"
          class="inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors normal-case"
        >
          {{ $t("tournament.recent.see_all") }}
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

    <div v-if="sectionDescription" :class="tacticalSectionDescriptionClasses">
      {{ sectionDescription }}
    </div>

    <div
      v-if="loading && horizontal"
      class="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <Skeleton
        v-for="i in 4"
        :key="i"
        :class="[
          'shrink-0 rounded-md',
          cardVariant === 'simple' ? 'h-48 w-80' : 'aspect-video w-96',
        ]"
      />
    </div>

    <div v-else-if="loading" class="space-y-2">
      <Skeleton
        v-for="i in Math.min(limit, 3)"
        :key="i"
        :class="
          cardVariant === 'compact'
            ? 'h-16 w-full rounded-md'
            : cardVariant === 'simple'
              ? 'h-48 w-80 rounded-lg'
              : 'h-[220px] w-full rounded-xl sm:h-[250px] lg:h-[290px]'
        "
      />
    </div>

    <HorizontalScrollRow
      v-else-if="hasTournaments && horizontal"
      ref="scrollRef"
      @approaching-end="loadMore"
    >
      <TournamentCard
        v-for="(tournament, index) in tournaments"
        :key="tournament.id"
        :tournament="tournament"
        :variant="cardVariant"
        :status-variant="statusVariant"
        :status-label="statusLabel"
        :priority="index === 0"
        :class="[
          'shrink-0 snap-start',
          cardVariant === 'simple' ? '' : 'aspect-video w-96',
        ]"
      />
    </HorizontalScrollRow>

    <div
      v-else-if="hasTournaments"
      :class="cardVariant === 'compact' ? 'space-y-2' : 'space-y-4'"
    >
      <TournamentCard
        v-for="(tournament, index) in tournaments"
        :key="tournament.id"
        :tournament="tournament"
        :variant="cardVariant"
        :status-variant="statusVariant"
        :status-label="statusLabel"
        :priority="index === 0"
      />
    </div>

    <div
      v-else
      class="relative overflow-hidden rounded-md border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center [background-image:repeating-linear-gradient(135deg,transparent_0,transparent_8px,hsl(var(--muted-foreground)/0.04)_8px,hsl(var(--muted-foreground)/0.04)_9px)]"
    >
      <div
        class="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground/80"
      >
        <span
          aria-hidden="true"
          class="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
        ></span>
        {{ emptyLabel || $t("tournament.recent.standby_no_tournaments") }}
      </div>
      <p
        v-if="emptyDescription"
        class="mt-1.5 text-xs text-muted-foreground/70"
      >
        {{ emptyDescription }}
      </p>
    </div>

    <Dialog v-if="seeAllAsModal" v-model:open="seeAllOpen">
      <DialogScrollContent class="max-w-4xl">
        <DialogHeader>
          <DialogTitle
            class="font-mono text-sm uppercase tracking-[0.24em] text-muted-foreground"
          >
            {{ sectionLabel }}
          </DialogTitle>
          <DialogDescription v-if="sectionDescription">
            {{ sectionDescription }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="seeAllLoading" :class="seeAllLayoutClasses">
          <Skeleton
            v-for="i in 4"
            :key="i"
            :class="
              cardVariant === 'simple'
                ? 'h-48 w-80 rounded-lg'
                : 'h-24 w-full rounded-md'
            "
          />
        </div>

        <div v-else-if="seeAllTournaments.length" :class="seeAllLayoutClasses">
          <TournamentCard
            v-for="tournament in seeAllTournaments"
            :key="tournament.id"
            :tournament="tournament"
            :variant="cardVariant"
            :status-variant="statusVariant"
            :status-label="statusLabel"
          />
        </div>

        <div
          v-else
          class="py-8 text-center font-mono text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground/80"
        >
          {{ emptyLabel || $t("tournament.recent.standby_no_tournaments") }}
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
