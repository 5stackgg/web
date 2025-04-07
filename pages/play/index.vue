<script setup lang="ts">
import { Button } from "@/components/ui/button";
import MyUpcomingMatches from "~/components/MyUpcomingMatches.vue";
import Matchmaking from "~/components/matchmaking/Matchmaking.vue";
import { PlusCircle } from "lucide-vue-next";
import PageHeading from "~/components/PageHeading.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import OpenMatches from "~/components/match/OpenMatches.vue";
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-4">
    <div class="lg:w-3/4 flex flex-col gap-4 overflow-hidden">
      <PageHeading>
        <template #title>{{ $t("pages.play.title") }}</template>

        <template #description>
          {{ $t("pages.play.description") }}
        </template>

        <template #actions>
          <div class="flex gap-4 items-center">
            <template v-if="!canCreateMatch">
              <FiveStackToolTip :size="16" class="text-red-600">{{
                $t("pages.play.admin_disabled")
              }}</FiveStackToolTip>
            </template>
            <Button
              size="lg"
              :disabled="!canCreateMatch"
              @click="canCreateMatch && navigateTo('/matches/create')"
            >
              <PlusCircle class="w-4 h-4" />
              <span class="hidden md:inline ml-2">{{
                $t("pages.play.create_match")
              }}</span>
            </Button>
          </div>
        </template>
      </PageHeading>

      <MyUpcomingMatches></MyUpcomingMatches>

      <Separator class="my-4" />

      <Card class="p-4">
        <CardHeader>
          <CardTitle>{{ $t("pages.play.open_matches.title") }}</CardTitle>
          <CardDescription>
            {{ $t("pages.play.open_matches.description") }}
          </CardDescription>
        </CardHeader>
        <OpenMatches> </OpenMatches>
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
            {{ $t("pages.play.matchmaking.title") }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="relative">
            <div
              class="absolute -inset-1 bg-gradient-to-r from-pink-400 to-purple-400 rounded-lg blur opacity-15 pointer-events-none"
            ></div>
            <Matchmaking class="w-full"></Matchmaking>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script lang="ts">
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
      return useApplicationSettingsStore().canCreateMatch;
    },
  },
};
</script>
