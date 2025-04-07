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
import MatchPicksDisplay from "~/components/match/MatchPicksDisplay.vue";
import MatchOptionsDisplay from "~/components/match//MatchOptionsDisplay.vue";
import { Cross2Icon } from "@radix-icons/vue";
import { ScrollArea } from "~/components/ui/scroll-area";
import ServiceLogs from "~/components/ServiceLogs.vue";

const commander = new EventEmitter();
provide("commander", commander);
</script>

<template>
  <Tabs default-value="overview">
    <TabsList class="lg:inline-flex grid grid-cols-1 mb-4">
      <TabsTrigger value="overview">
        {{ $t("match.tabs.overview") }}
      </TabsTrigger>
      <TabsTrigger :disabled="disableStats" value="utility">
        {{ $t("match.tabs.utility") }}
      </TabsTrigger>
      <TabsTrigger :disabled="disableStats" value="opening-duels">
        {{ $t("match.tabs.opening_duels") }}
      </TabsTrigger>
      <TabsTrigger :disabled="disableStats" value="clutches">
        {{ $t("match.tabs.clutches") }}
      </TabsTrigger>
      <TabsTrigger
        value="veto"
        :disabled="match.match_maps.length === 0"
        v-if="match.options.map_veto"
      >
        {{ $t("match.tabs.map_veto_tab") }}
      </TabsTrigger>
      <TabsTrigger value="settings">
        {{ $t("match.tabs.settings") }}
      </TabsTrigger>
      <TabsTrigger
        :disabled="!match.server_id"
        value="server"
        v-if="canViewServerConsole"
      >
        {{ $t("match.tabs.server_console") }}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="overview" class="grid gap-4">
      <Button v-if="canRandomize" variant="destructive" @click="randomizeTeams">
        {{ $t("match.tabs.randomize_teams") }}
      </Button>

      <Card class="w-fit">
        <CardHeader></CardHeader>
        <CardContent>
          <LineupOverview
            :match="match"
            :lineup="match.lineup_1"
          ></LineupOverview>
        </CardContent>
      </Card>

      <Card class="w-fit">
        <CardHeader></CardHeader>
        <CardContent>
          <LineupOverview
            :match="match"
            :lineup="match.lineup_2"
          ></LineupOverview>
        </CardContent>
      </Card>

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
                <CardHeader></CardHeader>
                <CardContent>
                  <LineupOverview
                    :match="match"
                    :lineup="match.lineup_1"
                    :show-stats="false"
                    @joined="inviteDialog = false"
                  ></LineupOverview>
                </CardContent>
              </Card>

              <Card class="w-full md:w-1/2">
                <CardHeader></CardHeader>
                <CardContent>
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
      <Card>
        <CardHeader> </CardHeader>
        <CardContent>
          <lineup-utility
            :match="match"
            :lineup="match.lineup_1"
          ></lineup-utility>
        </CardContent>
        <CardContent>
          <lineup-utility
            :match="match"
            :lineup="match.lineup_2"
          ></lineup-utility>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="opening-duels">
      <Card>
        <CardHeader> </CardHeader>
        <CardContent>
          <lineup-opening-duels
            :match="match"
            :lineup="match.lineup_1"
          ></lineup-opening-duels>
        </CardContent>
        <CardContent>
          <lineup-opening-duels
            :match="match"
            :lineup="match.lineup_2"
          ></lineup-opening-duels>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="clutches">
      <Card>
        <CardHeader> </CardHeader>
        <CardContent>
          <lineup-clutches
            :match="match"
            :lineup1="match.lineup_1"
            :lineup2="match.lineup_2"
          ></lineup-clutches>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="veto">
      <Card>
        <CardHeader> </CardHeader>
        <CardContent>
          <MatchPicksDisplay :match="match" />
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="server" class="flex flex-col gap-4">
      <ServiceLogs
        :service="`m-${match.id}`"
        :compact="true"
        v-if="match.server_type === 'On Demand'"
      />

      <RconCommander
        :server-id="match.server_id"
        :online="match.is_server_online"
        v-slot="{ commander }"
      >
        <template v-for="command of availableCommands">
          <DropdownMenuItem
            :disabled="!match.is_server_online"
            @click="commander(command.value, '')"
          >
            {{ command.display }}
          </DropdownMenuItem>
        </template>

        <form
          @submit.prevent="commander('restore_round', form.values.round)"
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
                    <SelectItem
                      :value="round.round.toString()"
                      v-for="round of currentMap.rounds"
                    >
                      {{
                        $t("match.tabs.round", {
                          number: round.round.toString(),
                        })
                      }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button type="submit">{{ $t("match.tabs.restore_round") }}</Button>
        </form>
      </RconCommander>
    </TabsContent>
    <TabsContent value="settings">
      <Card class="p-3 w-full sm:max-w-[500px]">
        <CardContent>
          <MatchOptionsDisplay :options="match.options"></MatchOptionsDisplay>

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
                    {{ match.e_region.description }}
                  </span>
                </li>
              </ul>
            </div>
          </template>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import { e_match_map_status_enum, e_match_status_enum } from "~/generated/zeus";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { generateMutation } from "~/graphql/graphqlGen";

enum AvailableCommands {
  Pause = "css_pause",
  Resume = "css_resume",
  SkipKnife = "skip_knife",
  ForceReady = "force_ready",
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
};

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      inviteDialog: false,
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
    disableStats() {
      return [
        e_match_status_enum.PickingPlayers,
        e_match_status_enum.Scheduled,
        e_match_status_enum.Veto,
        e_match_status_enum.WaitingForCheckIn,
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
          break;
        case e_match_map_status_enum.Paused:
          commands.push(CommandDetails[AvailableCommands.Resume]);
          break;
        case e_match_map_status_enum.Live:
        case e_match_map_status_enum.Overtime:
          commands.push(CommandDetails[AvailableCommands.Pause]);
          break;
      }

      return commands;
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
    canViewServerConsole() {
      const { isAdmin, isMatchOrganizer, isTournamentOrganizer } =
        useAuthStore();
      return isAdmin || isMatchOrganizer || isTournamentOrganizer;
    },
    canRandomize() {
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
  },
  methods: {
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
