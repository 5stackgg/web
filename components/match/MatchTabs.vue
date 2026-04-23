<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import LineupOverview from "~/components/match/LineupOverview.vue";
import LineupUtility from "~/components/match/LineupUtility.vue";
import LineupOpeningDuels from "~/components/match/LineupOpeningDuels.vue";
import LineupClutches from "~/components/match/LineupClutches.vue";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import MatchPicksDisplay from "~/components/match/MatchPicksDisplay.vue";
import MatchOptionsDisplay from "~/components/match//MatchOptionsDisplay.vue";
import RoundHistoryBar from "~/components/match/RoundHistoryBar.vue";
import { Cross2Icon } from "@radix-icons/vue";
import { ScrollArea } from "~/components/ui/scroll-area";
import { e_match_types_enum } from "~/generated/zeus";
import MatchForm from "~/components/match/MatchForm.vue";
import MatchLiveStreams from "~/components/match/MatchLiveStreams.vue";
import PlayerInvites from "~/components/match/PlayerInvites.vue";
</script>

<template>
  <Tabs v-model="activeTab" class="match-tabs">
    <!-- Mobile: single dropdown -->
    <div class="mb-4 lg:hidden">
      <Select v-model="activeTab">
        <SelectTrigger
          class="w-full"
          :aria-label="$t('ui.tooltips.match_section')"
        >
          <SelectValue :placeholder="$t('match.tabs.overview')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="overview">
            {{ $t("match.tabs.overview") }}
          </SelectItem>
          <SelectItem value="utility" :disabled="disableStats">
            {{ $t("match.tabs.utility") }}
          </SelectItem>
          <SelectItem value="opening-duels" :disabled="disableStats">
            {{ $t("match.tabs.opening_duels") }}
          </SelectItem>
          <SelectItem
            v-if="match.options.type !== e_match_types_enum.Duel"
            value="clutches"
            :disabled="disableStats"
          >
            {{ $t("match.tabs.clutches") }}
          </SelectItem>
          <SelectItem
            v-if="match.options.map_veto || match.options.region_veto"
            value="veto"
            :disabled="match.match_maps.length === 0"
          >
            {{ $t("common.map_veto") }}
          </SelectItem>
          <SelectItem value="settings">
            {{ $t("match.tabs.settings") }}
          </SelectItem>
          <SelectItem value="streams" :disabled="!canConfigureStreams">
            {{ $t("match.tabs.streams") }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div
      class="hidden lg:block mb-4 max-w-full overflow-x-auto match-tabs__scroll"
    >
      <TabsList variant="underline" class="h-auto flex-nowrap">
        <TabsTrigger value="overview">
          {{ $t("match.tabs.overview") }}
        </TabsTrigger>
        <TabsTrigger :disabled="disableStats" value="utility">
          {{ $t("match.tabs.utility") }}
        </TabsTrigger>
        <TabsTrigger :disabled="disableStats" value="opening-duels">
          {{ $t("match.tabs.opening_duels") }}
        </TabsTrigger>
        <TabsTrigger
          :disabled="disableStats"
          value="clutches"
          v-if="match.options.type !== e_match_types_enum.Duel"
        >
          {{ $t("match.tabs.clutches") }}
        </TabsTrigger>
        <TabsTrigger
          value="veto"
          :disabled="match.match_maps.length === 0"
          v-if="match.options.map_veto || match.options.region_veto"
        >
          {{ $t("common.map_veto") }}
        </TabsTrigger>
        <TabsTrigger value="settings">
          {{ $t("match.tabs.settings") }}
        </TabsTrigger>
        <TabsTrigger value="streams" :disabled="!canConfigureStreams">
          {{ $t("match.tabs.streams") }}
        </TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="overview">
      <div class="grid gap-4 max-w-[1500px]">
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <LineupOverview
              :match="match"
              :lineup="match.lineup_1"
            ></LineupOverview>
          </CardContent>
        </Card>

        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <LineupOverview
              :match="match"
              :lineup="match.lineup_2"
            ></LineupOverview>
          </CardContent>
        </Card>

        <Card
          v-if="singleMapForHistory && singleMapForHistory.rounds?.length > 0"
          class="overflow-x-auto"
        >
          <CardContent class="py-3">
            <RoundHistoryBar
              :match="match"
              :match-map="singleMapForHistory"
            />
          </CardContent>
        </Card>
      </div>

      <div
        v-if="canAdjustLineups"
        class="flex flex-wrap gap-2 mt-3 md:gap-3 md:justify-end container mx-auto px-4"
      >
        <Button variant="outline" class="px-4" @click="randomizeTeams">
          {{ $t("match.tabs.randomize_teams") }}
        </Button>
        <Button variant="outline" class="px-4" @click="swapLineups">
          {{ $t("match.tabs.swap_lineups") }}
        </Button>
      </div>

      <PlayerInvites v-if="me" class="mt-4" />

      <Drawer :open="inviteDialog">
        <DrawerContent class="p-4">
          <div class="flex justify-between items-center">
            <DrawerHeader>
              <DrawerTitle>{{ $t("match.tabs.invited_to_match") }}</DrawerTitle>
              <DrawerDescription>
                {{ $t("match.tabs.join_roster") }}
              </DrawerDescription>
            </DrawerHeader>

            <DrawerClose>
              <Button variant="outline" @click="inviteDialog = false">
                <Cross2Icon class="w-4 h-4" />
                <span class="sr-only">{{ $t("common.close") }}</span>
              </Button>
            </DrawerClose>
          </div>

          <ScrollArea class="max-h-[60vh] overflow-auto">
            <div class="w-full flex flex-col md:flex-row gap-4">
              <Card class="w-full md:w-1/2">
                <CardContent class="py-2">
                  <LineupOverview
                    :match="match"
                    :lineup="match.lineup_1"
                    :show-stats="false"
                    @joined="inviteDialog = false"
                  ></LineupOverview>
                </CardContent>
              </Card>

              <Card class="w-full md:w-1/2">
                <CardContent class="py-2">
                  <LineupOverview
                    :match="match"
                    :lineup="match.lineup_2"
                    :show-stats="false"
                    @joined="inviteDialog = false"
                  ></LineupOverview>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </TabsContent>
    <TabsContent value="utility">
      <div class="grid gap-4 max-w-[1500px]">
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <lineup-utility
              :match="match"
              :lineup="match.lineup_1"
            ></lineup-utility>
          </CardContent>
        </Card>
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <lineup-utility
              :match="match"
              :lineup="match.lineup_2"
            ></lineup-utility>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
    <TabsContent value="opening-duels">
      <div class="grid gap-4 max-w-[1500px]">
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <lineup-opening-duels
              :match="match"
              :lineup="match.lineup_1"
            ></lineup-opening-duels>
          </CardContent>
        </Card>
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <lineup-opening-duels
              :match="match"
              :lineup="match.lineup_2"
            ></lineup-opening-duels>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
    <TabsContent value="clutches">
      <div class="grid gap-4 max-w-[1500px]">
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <lineup-clutches
              :match="match"
              :lineup1="match.lineup_1"
              :lineup2="match.lineup_2"
            ></lineup-clutches>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
    <TabsContent value="veto">
      <div class="grid gap-4 max-w-[1500px]">
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <MatchPicksDisplay :match="match" />
          </CardContent>
        </Card>
      </div>
    </TabsContent>
    <TabsContent value="settings" class="flex flex-col gap-4 max-w-[1500px]">
      <Card>
        <CardContent class="py-4">
          <MatchOptionsDisplay
            :options="match.options"
            :show-details-by-default="true"
          ></MatchOptionsDisplay>

          <template v-if="displayServerInformation">
            <Separator class="my-8" />

            <div class="space-y-4">
              <h3 class="font-semibold">
                {{ $t("match.tabs.server_information") }}
              </h3>
              <ul class="space-y-3">
                <li class="flex items-center justify-between">
                  <span class="text-muted-foreground">{{
                    $t("match.tabs.type")
                  }}</span>
                  <span>{{ match.server_type || "TBD" }}</span>
                </li>
                <li class="flex items-center justify-between">
                  <span class="text-muted-foreground">{{
                    $t("match.tabs.region")
                  }}</span>
                  <span v-if="match.server_region">
                    {{ match.server_region }}
                  </span>
                  <span v-else-if="match.e_region">
                    {{ match.e_region.description || match.e_region.value }}
                  </span>
                </li>
              </ul>
            </div>
          </template>
        </CardContent>
      </Card>
      <Card v-if="match.is_organizer && showMatchSettingsForm">
        <CardContent class="py-4">
          <MatchForm :match="match" />
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="streams" class="max-w-[1500px]">
      <MatchLiveStreams :match="match" />
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import { e_match_status_enum, e_player_roles_enum } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  getRouteTabValue,
  normalizeRouteTab,
  replaceRouteTab,
} from "~/composables/useRouteTab";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      activeTab: "overview",
      inviteDialog: false,
    };
  },
  watch: {
    activeTab(newTab) {
      if (!this.availableMatchTabs.includes(newTab)) {
        return;
      }

      void replaceRouteTab(this.$router, this.$route, newTab, "overview");
    },
    "$route.query.tab": {
      immediate: true,
      handler() {
        this.syncActiveTabFromRoute();
      },
    },
    availableMatchTabs: {
      immediate: true,
      handler() {
        this.syncActiveTabFromRoute();
      },
    },
    $route: {
      immediate: true,
      handler() {
        if (
          this.$route.query.invite &&
          this.match.status === e_match_status_enum.PickingPlayers
        ) {
          this.inviteDialog = true;
        }
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    canConfigureStreams() {
      if (
        [
          e_match_status_enum.Finished,
          e_match_status_enum.Forfeit,
          e_match_status_enum.Surrendered,
          e_match_status_enum.Tie,
          e_match_status_enum.Canceled,
        ].includes(this.match.status)
      ) {
        return false;
      }

      return (
        this.match.is_organizer ||
        useAuthStore().isRoleAbove(e_player_roles_enum.streamer)
      );
    },
    disableStats() {
      return [
        e_match_status_enum.PickingPlayers,
        e_match_status_enum.Scheduled,
        e_match_status_enum.Veto,
        e_match_status_enum.WaitingForCheckIn,
      ].includes(this.match.status);
    },
    showMatchSettingsForm() {
      return ![
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
      ].includes(this.match.status);
    },
    displayServerInformation() {
      return [
        e_match_status_enum.Live,
        e_match_status_enum.Veto,
        e_match_status_enum.Scheduled,
        e_match_status_enum.WaitingForServer,
        e_match_status_enum.WaitingForCheckIn,
        e_match_status_enum.PickingPlayers,
      ].includes(this.match.status);
    },
    singleMapForHistory() {
      if (this.match.options?.best_of !== 1) return null;
      return this.match.match_maps?.[0] ?? null;
    },
    canAdjustLineups() {
      if (
        this.match.status !== e_match_status_enum.PickingPlayers ||
        !this.match.is_organizer
      ) {
        return false;
      }

      if (
        this.match.lineup_1.lineup_players.length <
          this.match.min_players_per_lineup ||
        this.match.lineup_2.lineup_players.length <
          this.match.min_players_per_lineup
      ) {
        return false;
      }

      return true;
    },
    availableMatchTabs() {
      const tabs = ["overview"];

      if (!this.disableStats) {
        tabs.push("utility", "opening-duels");

        if (this.match.options.type !== e_match_types_enum.Duel) {
          tabs.push("clutches");
        }
      }

      if (
        (this.match.options.map_veto || this.match.options.region_veto) &&
        this.match.match_maps.length > 0
      ) {
        tabs.push("veto");
      }

      tabs.push("settings");

      if (this.canConfigureStreams) {
        tabs.push("streams");
      }

      return tabs;
    },
  },
  methods: {
    syncActiveTabFromRoute() {
      const activeTab = getRouteTabValue(
        this.$route,
        this.availableMatchTabs,
        "overview",
      );

      if (this.activeTab !== activeTab) {
        this.activeTab = activeTab;
      }

      void normalizeRouteTab(
        this.$router,
        this.$route,
        this.availableMatchTabs,
        "overview",
      );
    },
    async swapLineups() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          swapLineups: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
    async randomizeTeams() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          randomizeTeams: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
