<script setup lang="ts">
import { useRestoredRefs } from "~/composables/useRestoredState";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useSubscription } from "@vue/apollo-composable";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { matchRowFields } from "~/graphql/simpleMatchFields";
import PlayerMatchesTable from "~/components/player/PlayerMatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import { Skeleton } from "~/components/ui/skeleton";
import { useMatchRowStats } from "~/composables/useMatchRowStats";
import { usePerPage } from "~/composables/usePerPage";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import {
  countTournamentMatches,
  tournamentMatchesFor,
  type TournamentMatchFilter,
} from "~/utilities/tournamentMatchFilter";

// Every match in the tournament as full rows, live: both sides and each
// match's top player. Paged here -- the subscription carries no per-player
// elo, and the stats are fetched for the page shown only.
const props = defineProps<{ tournamentId: string }>();

const { t } = useI18n();

const { result, loading } = useSubscription(
  typedGql("subscription")({
    matches: [
      {
        where: {
          tournament_brackets: {
            stage: { tournament_id: { _eq: $("tournamentId", "uuid!") } },
          },
        },
        order_by: [{ created_at: order_by.desc }],
      },
      matchRowFields,
    ],
  } as any),
  () => ({ tournamentId: props.tournamentId }),
);

const matches = computed<any[]>(() => (result.value as any)?.matches ?? []);

const filter = ref<string>("all");
const page = ref(1);
const perPage = usePerPage("tournament-matches");
// Back to the tournament lands on the same filter and page of its matches.
useRestoredRefs("tournament-matches", { page, filter });
watch([perPage, filter], () => (page.value = 1));

const counts = computed(() => countTournamentMatches(matches.value));
const filterOptions = computed(() =>
  (["live", "upcoming", "results", "all"] as const).map((key) => ({
    key,
    label: t(`tournament.matches_filter.${key}`),
    count: counts.value[key],
  })),
);

const filtered = computed(() =>
  tournamentMatchesFor(matches.value, filter.value as TournamentMatchFilter),
);
// Live shrinks under you as matches finish; a page past the end shows the
// last one instead of an empty table.
const shownPage = computed(() =>
  Math.min(
    page.value,
    Math.max(1, Math.ceil(filtered.value.length / perPage.value)),
  ),
);
const pageMatches = computed(() =>
  filtered.value.slice(
    (shownPage.value - 1) * perPage.value,
    shownPage.value * perPage.value,
  ),
);

const { statsByMatch, ratingByMatch, topPlayerByMatch } = useMatchRowStats(
  pageMatches,
  ref(null),
);
</script>

<template>
  <div v-if="loading && !matches.length" class="space-y-1.5" aria-busy="true">
    <Skeleton v-for="i in 5" :key="i" class="h-14 w-full rounded-lg" />
  </div>

  <div v-else class="grid gap-3">
    <AnimatedFilters v-model="filter" :options="filterOptions" square />

    <HeightSwap>
      <p
        v-if="!filtered.length"
        :key="`${filter}:empty`"
        class="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground"
      >
        {{ $t(`tournament.matches_filter.empty.${filter}`) }}
      </p>

      <div v-else :key="filter">
        <PlayerMatchesTable
          neutral
          :matches="pageMatches"
          :stats-by-match="statsByMatch"
          :rating-by-match="ratingByMatch"
          :top-player-by-match="topPlayerByMatch"
        />
        <Pagination
          class="mt-3"
          :page="shownPage"
          :per-page="perPage"
          :total="filtered.length"
          show-per-page-selector
          @page="(p: number) => (page = p)"
          @update:per-page="(size: number) => (perPage = size)"
        />
      </div>
    </HeightSwap>
  </div>
</template>
