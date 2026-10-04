<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { Skeleton } from "~/components/ui/skeleton";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import { Button } from "~/components/ui/button";
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
  createButtonClasses,
  listCreateButtonClasses,
} from "~/utilities/tacticalClasses";

const { client: apolloClient } = useApolloClient();

const loading = ref(true);
const seasons = ref<any[]>([]);
const { skeleton } = useDeferredLoading(() => loading.value);
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
  <h1 class="sr-only">{{ $t("league.list.title") }}</h1>

  <PageTransition :delay="0">
    <FadeSwap>
      <!-- Also held while a season exists: the page is redirecting to it. -->
      <Skeleton
        v-if="skeleton || seasons.length"
        key="loading"
        class="h-[240px] w-full rounded-lg"
        aria-busy="true"
      />

      <div v-else key="empty" class="space-y-5">
        <div v-if="isLeagueAdmin" class="flex items-center justify-end gap-2">
          <Button
            as-child
            variant="outline"
            size="sm"
            class="h-8 max-md:w-8 max-md:px-0"
          >
            <NuxtLink
              :to="{ name: 'settings-application-leagues' }"
              :title="$t('league.list.settings')"
            >
              <Settings class="h-4 w-4" />
              <span class="max-md:sr-only">{{
                $t("league.list.settings")
              }}</span>
            </NuxtLink>
          </Button>
          <Button
            size="sm"
            :class="listCreateButtonClasses"
            :title="$t('league.season_form.title')"
            @click="showCreateModal = true"
          >
            <PlusCircle class="h-4 w-4" />
            <span class="max-md:sr-only">{{
              $t("league.season_form.title")
            }}</span>
          </Button>
        </div>

        <SectionEmpty
          :title="$t('league.list.empty_title')"
          :description="$t('league.list.subtitle')"
        >
          <Button
            v-if="isLeagueAdmin"
            size="sm"
            :class="createButtonClasses"
            @click="showCreateModal = true"
          >
            <PlusCircle class="h-4 w-4" />
            {{ $t("league.season_form.title") }}
          </Button>
        </SectionEmpty>
      </div>
    </FadeSwap>
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
