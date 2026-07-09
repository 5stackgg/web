<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import { PlusCircle, Settings } from "lucide-vue-next";
import {
  Dialog,
  DialogScrollContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import LeagueSeasonForm from "~/components/league/LeagueSeasonForm.vue";
import { LEAGUE_OVERVIEW_QUERY } from "~/graphql/leagues";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
} from "~/utilities/tacticalClasses";

const { client: apolloClient } = useApolloClient();

const loading = ref(true);
const seasons = ref<any[]>([]);
const isLeagueAdmin = computed(() => useAuthStore().isAdmin);

const { showCreateModal, creatingSeason, createSeason } = useLeagueSeasonCreate(
  (seasonId) => {
    if (seasonId) {
      navigateTo({
        name: "league-seasons-seasonId",
        params: { seasonId },
      });
    }
  },
);

// The league landing is just a redirect to the latest season — season
// switching and creation live on the season page's header dropdown now. Only
// when no season exists do we show a create-first prompt here. Redirecting in
// onMounted (not setup) keeps NuxtPage's Suspense from wedging.
onMounted(async () => {
  try {
    const { data } = await apolloClient.query({
      query: LEAGUE_OVERVIEW_QUERY,
      fetchPolicy: "network-only",
    });
    seasons.value = data?.league_seasons ?? [];
    if (seasons.value.length) {
      await navigateTo({
        name: "league-seasons-seasonId",
        params: { seasonId: seasons.value[0].id },
      });
      return;
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-5 py-6">
      <div
        v-if="loading || seasons.length"
        class="py-12 text-center text-muted-foreground"
      >
        {{ $t("common.loading") }}
      </div>

      <template v-else>
        <TacticalPageHeader inline-actions>
          <template #title>{{ $t("league.list.title") }}</template>
          <template #subtitle>{{ $t("league.list.subtitle") }}</template>
          <template #actions>
            <NuxtLink
              v-if="isLeagueAdmin"
              :to="{ name: 'settings-application-leagues' }"
              :class="tacticalHeaderActionClasses"
              class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
            >
              <Settings class="h-4 w-4" />
              {{ $t("league.list.settings") }}
            </NuxtLink>
            <button
              v-if="isLeagueAdmin"
              type="button"
              :class="[tacticalCtaButtonClasses, tacticalHeaderActionClasses]"
              @click="showCreateModal = true"
            >
              <PlusCircle class="h-4 w-4" />
              {{ $t("league.season_form.title") }}
            </button>
          </template>
        </TacticalPageHeader>

        <section
          class="rounded-lg border border-dashed border-border py-12 text-center"
        >
          <p class="text-muted-foreground">{{ $t("league.seasons.empty") }}</p>
        </section>
      </template>
    </div>
  </PageTransition>

  <!-- Create season (admin) -->
  <Dialog v-model:open="showCreateModal">
    <DialogScrollContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ $t("league.season_form.title") }}</DialogTitle>
      </DialogHeader>
      <LeagueSeasonForm :submitting="creatingSeason" @submit="createSeason" />
    </DialogScrollContent>
  </Dialog>
</template>
