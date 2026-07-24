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
import TournamentFeatureCard from "~/components/tournament/TournamentFeatureCard.vue";
import TournamentCompactCard from "~/components/tournament/TournamentCompactCard.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const scrollRef = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);

type StatusVariant = "finished" | "live" | "registration" | "default";

const props = withDefaults(
  defineProps<{
    limit?: number;
    sectionLabel?: string;
    statuses?: e_tournament_status_enum[];
    statusVariant?: StatusVariant;
    statusLabel?: string;
    orderDirection?: "asc" | "desc";
    compact?: boolean;
    horizontal?: boolean;
    hideWhenEmpty?: boolean;
    emptyLabel?: string;
    emptyDescription?: string;
    // When set, only return tournaments whose roster contains this player.
    playerSteamId?: string | number | null;
    // Override the "See all" destination. Pass null to hide the link
    // (useful when this component is rendered on /tournaments itself).
    seeAllTo?: string | Record<string, any> | null;
  }>(),
  {
    limit: 8,
    sectionLabel: "RECENT.TOURNAMENTS",
    statuses: () => [e_tournament_status_enum.Finished],
    statusVariant: "finished",
    statusLabel: undefined,
    orderDirection: "desc",
    compact: false,
    horizontal: false,
    hideWhenEmpty: false,
    emptyLabel: "",
    emptyDescription: "",
    playerSteamId: null,
    seeAllTo: "/tournaments",
  },
);

const emit = defineEmits<{ loaded: [count: number] }>();

const tournaments = ref<any[]>([]);
const loading = ref(true);

// Load-more pattern — extendedLimit grows when the user approaches
// the right edge so the next batch is ready before they get there.
const extendedLimit = ref(props.limit);
const reachedEnd = ref(false);
const inFlight = ref(false);

async function fetchData() {
  if (tournaments.value.length === 0) loading.value = true;
  try {
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
            trophies: [
              { where: { placement: { _in: [1, 2, 3] } } } as any,
              {
                id: true,
                placement: true,
                tournament_team_id: true,
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
            start:
              props.orderDirection === "asc" ? order_by.asc : order_by.desc,
          },
        ],
        limit: extendedLimit.value,
      },
      fetchPolicy: "network-only",
    });
    tournaments.value = ((data as any)?.tournaments ?? []) as any[];
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
    fetchData();
  },
  { deep: true },
);

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
        <NuxtLink
          v-if="seeAllTo"
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

    <div
      v-if="loading && horizontal"
      class="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <Skeleton
        v-for="i in 4"
        :key="i"
        class="aspect-video w-96 shrink-0 rounded-md"
      />
    </div>

    <div v-else-if="loading" class="space-y-2">
      <Skeleton
        v-for="i in Math.min(limit, 3)"
        :key="i"
        :class="compact ? 'h-16 w-full rounded-md' : 'h-32 w-full rounded-md'"
      />
    </div>

    <HorizontalScrollRow
      v-else-if="hasTournaments && horizontal"
      ref="scrollRef"
      @approaching-end="loadMore"
    >
      <TournamentCompactCard
        v-for="tournament in tournaments"
        :key="tournament.id"
        :tournament="tournament"
        :status-variant="statusVariant"
        :status-label="statusLabel"
        class="aspect-video w-96 shrink-0 snap-start"
      />
    </HorizontalScrollRow>

    <div
      v-else-if="hasTournaments"
      :class="compact ? 'space-y-2' : 'space-y-3'"
    >
      <template v-for="tournament in tournaments" :key="tournament.id">
        <TournamentCompactCard
          v-if="compact"
          :tournament="tournament"
          :status-variant="statusVariant"
          :status-label="statusLabel"
        />
        <TournamentFeatureCard
          v-else
          :tournament="tournament"
          :status-variant="statusVariant"
          :status-label="statusLabel"
        />
      </template>
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
  </div>
</template>
