<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useSubscription } from "@vue/apollo-composable";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { matchRowFields } from "~/graphql/simpleMatchFields";
import PlayerMatchesTable from "~/components/player/PlayerMatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import { Skeleton } from "~/components/ui/skeleton";
import { useMatchRowStats } from "~/composables/useMatchRowStats";
import { usePerPage } from "~/composables/usePerPage";

// Every match in the tournament as full rows, live: both sides and each
// match's top player. Paged here -- the subscription carries no per-player
// elo, and the stats are fetched for the page shown only.
const props = defineProps<{ tournamentId: string }>();

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

const page = ref(1);
const perPage = usePerPage("tournament-matches");
watch(perPage, () => (page.value = 1));
const pageMatches = computed(() =>
  matches.value.slice(
    (page.value - 1) * perPage.value,
    page.value * perPage.value,
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

  <p
    v-else-if="!matches.length"
    class="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground"
  >
    {{ $t("tournament.results_section.no_matches_played") }}
  </p>

  <div v-else>
    <PlayerMatchesTable
      neutral
      :matches="pageMatches"
      :stats-by-match="statsByMatch"
      :rating-by-match="ratingByMatch"
      :top-player-by-match="topPlayerByMatch"
    />
    <Pagination
      class="mt-3"
      :page="page"
      :per-page="perPage"
      :total="matches.length"
      show-per-page-selector
      @page="(p: number) => (page = p)"
      @update:per-page="(size: number) => (perPage = size)"
    />
  </div>
</template>
