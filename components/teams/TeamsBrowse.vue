<script setup lang="ts">
import { ref } from "vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TeamsDirectory from "~/components/teams/TeamsDirectory.vue";
import TeamsTournamentTeams from "~/components/teams/TeamsTournamentTeams.vue";
import { useRestoredRefs } from "~/composables/useRestoredState";

// Every team, and the teams made inside tournaments, a tab each. The open
// list hands its own controls (sort, create, running / finished) to the tab
// row, so the tabs stay put while the lists swap under them.
defineProps<{ showCreate: boolean }>();

type View = "teams" | "tournament";

const view = ref<View>("teams");
useRestoredRefs("teams-browse", { view });

const controls = ref<HTMLElement | null>(null);

// Offered once some tournament has a team of its own.
const hasTournamentTeams = ref(false);
function onTournamentTeams(has: boolean) {
  hasTournamentTeams.value = has;
  if (!has && view.value === "tournament") {
    view.value = "teams";
  }
}
</script>

<template>
  <Tabs v-model="view" :unmount-on-hide="false">
    <div class="mb-3 flex flex-wrap items-center gap-x-2 gap-y-3">
      <TabsList variant="track" class="grid-cols-2 md:mr-auto md:w-auto">
        <TabsTrigger value="teams">
          {{ $t("pages.teams.directory.title") }}
        </TabsTrigger>
        <TabsTrigger
          v-if="hasTournamentTeams"
          value="tournament"
          :title="$t('pages.teams.tournament_teams.subtitle')"
        >
          {{ $t("pages.teams.tournament_teams.title") }}
        </TabsTrigger>
      </TabsList>
      <div ref="controls" class="contents" />
    </div>

    <TabsContent value="teams" class="tab-panel-in mt-0">
      <TeamsDirectory
        :show-create="showCreate"
        :header-to="view === 'teams' ? controls : null"
      />
    </TabsContent>
    <TabsContent value="tournament" class="tab-panel-in mt-0">
      <TeamsTournamentTeams
        :header-to="view === 'tournament' ? controls : null"
        @available="onTournamentTeams"
      />
    </TabsContent>
  </Tabs>
</template>
