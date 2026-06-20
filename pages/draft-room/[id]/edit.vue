<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import CreateDraftGame from "~/components/draft-games/CreateDraftGame.vue";

definePageMeta({
  middleware: ["draft-create"],
});

const route = useRoute();
const draftGame = ref<any | undefined>(undefined);

onMounted(async () => {
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      draft_games_by_pk: [
        { id: $("id", "uuid!") },
        {
          id: true,
          host_steam_id: true,
          status: true,
          mode: true,
          access: true,
          type: true,
          regions: true,
          map_pool_id: true,
          team_1_id: true,
          team_2_id: true,
          captain_selection: true,
          draft_order: true,
          require_approval: true,
          min_elo: true,
          max_elo: true,
          options: {
            lobby_access: true,
            ...matchOptionsFields,
          },
        },
      ],
    }),
    variables: {
      id: route.params.id,
    },
  });

  if (
    !data.draft_games_by_pk ||
    data.draft_games_by_pk.host_steam_id !== useAuthStore().me?.steam_id ||
    data.draft_games_by_pk.status !== "Open"
  ) {
    navigateTo(`/draft-room/${route.params.id}`);
    return;
  }

  draftGame.value = data.draft_games_by_pk;
});

const onSaved = () => {
  navigateTo(`/draft-room/${route.params.id}`);
};
</script>

<template>
  <PageTransition>
    <div class="mx-auto max-w-3xl pb-24">
      <TacticalPageHeader>
        <template #title>{{ $t("draft_games.room.edit_settings") }}</template>
      </TacticalPageHeader>
      <CreateDraftGame
        v-if="draftGame"
        :initial="draftGame"
        :editing="true"
        class="mt-4"
        @created="onSaved"
      />
    </div>
  </PageTransition>
</template>
