<script setup lang="ts">
import { Button } from "@/components/ui/button";
import MyUpcomingMatches from "~/components/MyUpcomingMatches.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MatchMaking from "~/components/match-making/MatchMaking.vue";
import { PlusCircle } from "lucide-vue-next";
import PageHeading from "~/components/PageHeading.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import OpenMatches from "~/components/match/OpenMatches.vue";
import MyRecentMatches from "~/components/match/MyRecentMatches.vue";
import OtherMatches from "~/components/match/OtherMatches.vue";
import LastTenWins from "~/components/charts/LastTenWins.vue";
import LastTenLosses from "~/components/charts/LastTenLosses.vue";
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-4">
    <div class="lg:w-3/4 flex flex-col gap-4 overflow-hidden">
      <PageHeading>
        <template #title> Upcoming Matches </template>

        <template #description>
          Your upcoming matches that either you manage or are in the lineup.
        </template>

        <template #actions>
          <div class="flex gap-4 items-center">
            <template v-if="!canCreateMatch">
              <FiveStackToolTip :size="16" class="text-red-600"
                >Admin has disabled creation of matches</FiveStackToolTip
              >
            </template>
            <Button
              size="lg"
              :disabled="!canCreateMatch"
              @click="canCreateMatch && navigateTo('/matches/create')"
            >
              <PlusCircle class="w-4 h-4" />
              <span class="hidden md:inline ml-2">Create Match</span>
            </Button>
          </div>
        </template>
      </PageHeading>

      <MyUpcomingMatches></MyUpcomingMatches>

      <Separator />
      <PageHeading>
        <template #title>Recent Matches</template>
        <template #description> Your most recent completed matches </template>
      </PageHeading>
      <MyRecentMatches></MyRecentMatches>

      <Separator />

      <Card class="p-4">
        <Tabs default-value="open">
          <TabsList>
            <TabsTrigger value="open"> Open Lobbies </TabsTrigger>
            <TabsTrigger value="other"> Other Matches </TabsTrigger>
          </TabsList>

          <TabsContent value="open">
            <OpenMatches> </OpenMatches>
          </TabsContent>
          <TabsContent value="other">
            <OtherMatches></OtherMatches>
          </TabsContent>
        </Tabs>
      </Card>

      <div id="pagination"></div>
    </div>

    <div class="lg:w-1/4 flex flex-col gap-4">
      <Card
        class="bg-gradient-to-br from-blue-900 to-purple-900 hidden lg:block"
        v-if="regions.length > 0 && matchMakingAllowed"
      >
        <CardHeader>
          <CardTitle class="text-xl font-bold text-center">
            Match Making
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="relative">
            <div
              class="absolute -inset-1 bg-gradient-to-r from-pink-400 to-purple-400 rounded-lg blur opacity-15 pointer-events-none"
            ></div>
            <MatchMaking class="w-full"></MatchMaking>
          </div>
        </CardContent>
      </Card>

      <Card class="flex justify-center items-center">
        <div class="text-center">
          <CardHeader>
            <CardTitle class="text-xl font-bold text-center">
              Last 10 Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LastTenWins />
          </CardContent>
        </div>
      </Card>
      <Card class="flex justify-center items-center">
        <div class="text-center">
          <CardHeader>
            <CardTitle class="text-xl font-bold text-center">
              Last 10 Losses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LastTenLosses />
          </CardContent>
        </div>
      </Card>
    </div>
  </div>
</template>

<script lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
    matchMakingAllowed() {
      return useApplicationSettingsStore().matchMakingAllowed;
    },
    canCreateMatch() {
      const allowedRole = useApplicationSettingsStore().matchCreateRole;

      if (allowedRole === e_player_roles_enum.user) {
        return true;
      }

      if (allowedRole === e_player_roles_enum.match_organizer) {
        return [
          e_player_roles_enum.match_organizer,
          e_player_roles_enum.tournament_organizer,
          e_player_roles_enum.administrator,
        ].includes(this.me.role);
      }

      if (allowedRole === e_player_roles_enum.tournament_organizer) {
        return [
          e_player_roles_enum.tournament_organizer,
          e_player_roles_enum.administrator,
        ].includes(this.me.role);
      }

      if (allowedRole === e_player_roles_enum.administrator) {
        return this.me.role === e_player_roles_enum.administrator;
      }

      return false;
    },
  },
};
</script>
