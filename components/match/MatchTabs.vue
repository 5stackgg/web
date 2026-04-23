<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import LineupOverview from "~/components/match/LineupOverview.vue";
import LineupUtility from "~/components/match/LineupUtility.vue";
import LineupOpeningDuels from "~/components/match/LineupOpeningDuels.vue";
import LineupClutches from "~/components/match/LineupClutches.vue";
import RconCommander from "~/components/servers/RconCommander.vue";
import { provide } from "vue";
import EventEmitter from "eventemitter3";
import { Button } from "~/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import MatchPicksDisplay from "~/components/match/MatchPicksDisplay.vue";
import MatchOptionsDisplay from "~/components/match//MatchOptionsDisplay.vue";
import MatchServerRebootControl from "~/components/match/MatchServerRebootControl.vue";
import { Cross2Icon } from "@radix-icons/vue";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import ServiceLogs from "~/components/ServiceLogs.vue";
import { e_match_types_enum } from "~/generated/zeus";
import MatchForm from "~/components/match/MatchForm.vue";
import MatchLiveStreams from "~/components/match/MatchLiveStreams.vue";
import PlayerInvites from "~/components/match/PlayerInvites.vue";
import cleanMapName from "~/utilities/cleanMapName";

const commander = new EventEmitter();
provide("commander", commander);
</script>

<template>
  <Tabs v-model="activeTab" class="match-tabs">
    <div
      class="map-filter-banner"
      :class="{ 'is-active': !!activeMap }"
      aria-live="polite"
    >
      <div
        class="relative flex items-center justify-between gap-3 px-3 py-2 border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.08)] [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%-10px))]"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="shrink-0 inline-block w-[6px] h-[6px] rounded-full bg-[hsl(var(--tac-amber))]"
          ></span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span
              class="font-mono text-[0.6rem] font-bold tracking-[0.28em] uppercase text-[hsl(var(--tac-amber))]"
            >
              Map Filter Active
            </span>
            <div class="map-filter-flip relative min-w-0">
              <Transition name="map-flip" mode="out-in">
                <span
                  v-if="activeMap"
                  :key="activeMap.id"
                  class="block font-mono text-[0.75rem] tracking-[0.12em] uppercase text-foreground truncate"
                >
                  {{ cleanMapName(activeMap.map.name) }}
                  <span
                    v-if="typeof activeMap.lineup_1_score === 'number'"
                    class="text-muted-foreground ml-2"
                  >
                    {{ activeMap.lineup_1_score }} :
                    {{ activeMap.lineup_2_score }}
                  </span>
                </span>
              </Transition>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="shrink-0 font-mono text-[0.65rem] tracking-[0.2em] uppercase gap-2 border border-transparent hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))]"
          @click="$emit('clear-active-map')"
        >
          <Cross2Icon class="w-3 h-3" />
          {{ $t("common.close") }}
        </Button>
      </div>
    </div>
    <!-- Mobile: map filter selector -->
    <div v-if="statsEligibleMaps.length > 1" class="mb-3 lg:hidden">
      <Select :model-value="mapSelectValue" @update:model-value="onMapSelect">
        <SelectTrigger class="w-full" aria-label="Filter stats by map">
          <SelectValue :placeholder="$t('match.all_maps') || 'All Maps'" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">
            {{ $t("match.all_maps") || "All Maps" }}
          </SelectItem>
          <SelectItem v-for="m in statsEligibleMaps" :key="m.id" :value="m.id">
            {{ cleanMapName(m.map.name) }}
            <span
              v-if="typeof m.lineup_1_score === 'number'"
              class="text-muted-foreground ml-2"
            >
              {{ m.lineup_1_score }} : {{ m.lineup_2_score }}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
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
          <SelectItem v-if="canViewAdmin" value="server">
            {{ $t("match.tabs.admin") }}
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
        <TabsTrigger value="server" v-if="canViewAdmin">
          {{ $t("match.tabs.admin") }}
        </TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="overview">
      <div
        class="grid gap-4 max-w-[1500px] transition-opacity duration-200"
        :class="{ 'opacity-60': activeMap && !mapStats }"
      >
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <LineupOverview
              :match="mapScopedMatch"
              :lineup="activeLineup1"
            ></LineupOverview>
          </CardContent>
        </Card>

        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <LineupOverview
              :match="mapScopedMatch"
              :lineup="activeLineup2"
            ></LineupOverview>
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
      <div
        class="grid gap-4 max-w-[1500px] transition-opacity duration-200"
        :class="{ 'opacity-60': activeMap && !mapStats }"
      >
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <lineup-utility
              :match="mapScopedMatch"
              :lineup="activeLineup1"
            ></lineup-utility>
          </CardContent>
        </Card>
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <lineup-utility
              :match="mapScopedMatch"
              :lineup="activeLineup2"
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
              :selected-map-id="activeMap?.id"
            ></lineup-opening-duels>
          </CardContent>
        </Card>
        <Card class="overflow-x-auto">
          <CardContent class="py-2">
            <lineup-opening-duels
              :match="match"
              :lineup="match.lineup_2"
              :selected-map-id="activeMap?.id"
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
              :selected-map-id="activeMap?.id"
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
    <TabsContent
      value="server"
      class="flex flex-col gap-4 max-w-[1500px] w-full overflow-x-auto"
    >
      <AlertDialog :open="showConfirmDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ $t("common.confirm") }}</AlertDialogTitle>
            <AlertDialogDescription class="flex flex-col gap-2">
              <span>{{ $t("common.are_you_sure") }}</span>
              <Badge variant="secondary" class="w-fit">
                {{ pendingCommand?.display }}
              </Badge>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="showConfirmDialog = false">
              {{ $t("common.cancel") }}
            </AlertDialogCancel>
            <AlertDialogAction
              @click="
                executePending && executePending();
                showConfirmDialog = false;
              "
            >
              {{ $t("common.confirm") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MatchServerRebootControl :match="match" />

      <RconCommander
        :server-id="match.server_id"
        :online="match.is_server_online"
        :match-id="match.id"
        v-slot="{ commander: send }"
        v-if="canSendRCONCommands"
      >
        <template v-for="command of availableCommands">
          <DropdownMenuItem
            :disabled="!match.is_server_online"
            @click="
              command.confirm
                ? confirmCommand(command, send)
                : send(command.value, '')
            "
          >
            {{ command.display }}
          </DropdownMenuItem>
        </template>

        <form
          @submit.prevent="send('restore_round', form.values.round)"
          v-if="currentMap?.rounds.length > 0"
        >
          <FormField v-slot="{ componentField }" name="round">
            <FormItem>
              <FormLabel>{{ $t("match.tabs.restore_round") }}</FormLabel>
              <Select
                v-bind="componentField"
                @update:model-value="
                  (value) => form.setFieldValue('round', value)
                "
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      :placeholder="$t('match.tabs.select_round_to_restore')"
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <template v-for="round of currentMap.rounds">
                      <SelectItem
                        v-if="round.has_backup_file && round.round > 0"
                        :value="round.round.toString()"
                      >
                        {{
                          $t("common.round", {
                            number: round.round.toString(),
                          })
                        }}
                      </SelectItem>
                    </template>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button type="submit">{{ $t("match.tabs.restore_round") }}</Button>
        </form>
      </RconCommander>

      <div
        v-if="!hasLogs"
        class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-8 text-center"
      >
        <h3 class="font-semibold">{{ $t("match.tabs.no_logs_title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ $t("match.tabs.no_logs_description") }}
        </p>
      </div>
      <ServiceLogs
        v-show="hasLogs"
        :service="`m-${match.id}`"
        :compact="true"
        @has-logs="hasLogs = $event"
      />
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

<style scoped>
.map-filter-banner {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  margin-bottom: 0;
  transition:
    grid-template-rows 220ms ease,
    opacity 180ms ease,
    margin-bottom 220ms ease;
}

.map-filter-banner > * {
  min-height: 0;
  overflow: hidden;
}

.map-filter-banner.is-active {
  grid-template-rows: 1fr;
  opacity: 1;
  margin-bottom: 1rem;
}

.map-filter-flip {
  perspective: 600px;
}

.map-flip-enter-active,
.map-flip-leave-active {
  transition:
    transform 240ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 160ms ease;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform, opacity;
}

.map-flip-enter-from {
  transform: rotateX(-90deg);
  opacity: 0;
}

.map-flip-leave-to {
  transform: rotateX(90deg);
  opacity: 0;
}
</style>

<script lang="ts">
import {
  $,
  order_by,
  e_match_map_status_enum,
  e_match_status_enum,
  e_player_roles_enum,
} from "~/generated/zeus";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { matchMapStats } from "~/graphql/matchMapStatsGraphql";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";
import {
  getRouteTabValue,
  normalizeRouteTab,
  replaceRouteTab,
} from "~/composables/useRouteTab";

enum AvailableCommands {
  Pause = "css_pause",
  Resume = "css_resume",
  SkipKnife = "skip_knife",
  ForceReady = "force_ready",
  Knife = "match_state Knife",
  Warmup = "match_state Warmup",
}

const CommandDetails = {
  [AvailableCommands.Pause]: {
    display: "Pause Match",
    value: AvailableCommands.Pause,
  },
  [AvailableCommands.Resume]: {
    display: "Resume Match",
    value: AvailableCommands.Resume,
  },
  [AvailableCommands.SkipKnife]: {
    display: "Skip Knife",
    value: AvailableCommands.SkipKnife,
  },
  [AvailableCommands.ForceReady]: {
    display: "Force Ready",
    value: AvailableCommands.ForceReady,
  },
  [AvailableCommands.Knife]: {
    display: "Reset to Knife",
    value: AvailableCommands.Knife,
    confirm: true,
  },
  [AvailableCommands.Warmup]: {
    display: "Reset to Warmup",
    value: AvailableCommands.Warmup,
    confirm: true,
  },
};

export default {
  emits: ["clear-active-map", "select-map"],
  props: {
    match: {
      type: Object,
      required: true,
    },
    activeMap: {
      type: Object as () => {
        id: string;
        map: { name: string };
        lineup_1_score?: number;
        lineup_2_score?: number;
      } | null,
      default: null,
    },
  },
  data() {
    return {
      activeTab: "overview",
      inviteDialog: false,
      mapStats: null as null | { lineup_1: any; lineup_2: any },
      mapStatsLoading: false,
      hasLogs: false,
      showConfirmDialog: false,
      pendingCommand: null as
        | undefined
        | { value: string; display: string; confirm: boolean },
      executePending: undefined as undefined | (() => void),
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            round: z.string(),
          }),
        ),
      }),
    };
  },
  watch: {
    activeMap: {
      immediate: true,
      handler(map, prev) {
        if (map) {
          void this.fetchMapStats();
          const statsTabs = [
            "overview",
            "utility",
            "opening-duels",
            "clutches",
          ];
          if (!prev && !statsTabs.includes(this.activeTab)) {
            this.activeTab = "overview";
          }
        } else {
          this.mapStats = null;
        }
      },
    },
    "activeMap.id"() {
      if (this.activeMap) {
        void this.fetchMapStats();
      }
    },
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
    mapScopedMatch() {
      if (!this.activeMap) return this.match;
      const scopedMap = this.match.match_maps?.find(
        (m: any) => m.id === this.activeMap!.id,
      );
      return {
        ...this.match,
        match_maps: scopedMap ? [scopedMap] : [this.activeMap],
      };
    },
    activeLineup1() {
      if (this.activeMap && this.mapStats?.lineup_1) {
        return this.mapStats.lineup_1;
      }
      return this.match.lineup_1;
    },
    activeLineup2() {
      if (this.activeMap && this.mapStats?.lineup_2) {
        return this.mapStats.lineup_2;
      }
      return this.match.lineup_2;
    },
    statsEligibleMaps() {
      return (this.match.match_maps ?? []).filter(
        (m: any) => m.status !== e_match_status_enum.Scheduled,
      );
    },
    mapSelectValue() {
      return this.activeMap?.id ?? "__all__";
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
    currentMap() {
      return this.match.match_maps.find((match_map) => {
        return match_map.is_current_map;
      });
    },
    availableCommands() {
      const commands = [];

      switch (this.currentMap?.status) {
        case e_match_map_status_enum.Warmup:
        case e_match_map_status_enum.Scheduled:
          commands.push(CommandDetails[AvailableCommands.ForceReady]);
          break;
        case e_match_map_status_enum.Knife:
          commands.push(CommandDetails[AvailableCommands.SkipKnife]);
          commands.push(CommandDetails[AvailableCommands.Warmup]);
          break;
        case e_match_map_status_enum.Paused:
          commands.push(CommandDetails[AvailableCommands.Resume]);
          commands.push(CommandDetails[AvailableCommands.Warmup]);
          commands.push(CommandDetails[AvailableCommands.Knife]);
          break;
        case e_match_map_status_enum.Live:
        case e_match_map_status_enum.Overtime:
          commands.push(CommandDetails[AvailableCommands.Pause]);
          break;
      }

      return commands;
    },
    canViewAdmin() {
      return this.match.is_organizer;
    },
    canSendRCONCommands() {
      return [
        e_match_status_enum.Live,
        e_match_status_enum.PickingPlayers,
        e_match_status_enum.Scheduled,
        e_match_status_enum.Veto,
        e_match_status_enum.WaitingForCheckIn,
        e_match_status_enum.WaitingForServer,
      ].includes(this.match.status);
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

      if (this.canViewAdmin) {
        tabs.push("server");
      }

      return tabs;
    },
  },
  methods: {
    onMapSelect(value: string) {
      if (!value || value === "__all__") {
        this.$emit("clear-active-map");
        return;
      }
      const map = this.match.match_maps?.find((m: any) => m.id === value);
      if (map) {
        this.$emit("select-map", map);
      }
    },
    async fetchMapStats() {
      if (!this.activeMap) return;
      const requestedMapId = this.activeMap.id;
      this.mapStatsLoading = true;
      try {
        const { data } = await this.$apollo.query({
          variables: {
            matchId: this.match.id,
            matchMapId: requestedMapId,
            order_by_name: order_by.asc,
          },
          fetchPolicy: "network-only",
          query: generateQuery({
            matches_by_pk: [
              { id: $("matchId", "uuid!") },
              {
                lineup_1: [{}, matchMapStats],
                lineup_2: [{}, matchMapStats],
              },
            ],
          }),
        });
        if (this.activeMap?.id !== requestedMapId) return;
        this.mapStats = data?.matches_by_pk ?? null;
      } finally {
        this.mapStatsLoading = false;
      }
    },
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
    confirmCommand(
      command: {
        value: string;
        display: string;
        confirm: boolean;
      },
      send,
    ) {
      this.pendingCommand = command;
      this.executePending = () => send(command.value, "");
      this.showConfirmDialog = true;
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
