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
import { separateByCapitalLetters } from "~/utilities/separateByCapitalLetters";
import BooleanToText from "../BooleanToText.vue";
import MatchPicksDisplay from "~/components/match/MatchPicksDisplay.vue";

const commander = new EventEmitter();
provide("commander", commander);
</script>

<template>
  <Tabs default-value="overview">
    <TabsList class="lg:inline-flex grid grid-cols-1 mb-4">
      <TabsTrigger value="overview"> Overview </TabsTrigger>
      <TabsTrigger value="veto" v-if="match.options.map_veto">
        Map Veto
      </TabsTrigger>
      <TabsTrigger :disabled="disableStats" value="utility">
        Utility
      </TabsTrigger>
      <TabsTrigger :disabled="disableStats" value="opening-duels">
        Opening Duels
      </TabsTrigger>
      <TabsTrigger :disabled="disableStats" value="clutches">
        Clutches
      </TabsTrigger>
      <TabsTrigger value="settings"> Match Settings </TabsTrigger>
      <TabsTrigger :disabled="!match.server_id" value="server">
        Server Console
      </TabsTrigger>
    </TabsList>
    <TabsContent value="overview" class="grid gap-4">
      <Card class="w-full">
        <CardHeader></CardHeader>
        <CardContent>
          <LineupOverview
            :match="match"
            :lineup="match.lineup_1"
          ></LineupOverview>
        </CardContent>
      </Card>

      <Card class="w-full">
        <CardHeader></CardHeader>
        <CardContent>
          <LineupOverview
            :match="match"
            :lineup="match.lineup_2"
          ></LineupOverview>
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
    <TabsContent value="server">
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
              <FormLabel>Restore Round</FormLabel>
              <Select
                v-bind="componentField"
                @update:model-value="
                  (value) => form.setFieldValue('round', value)
                "
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select the round to restore" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      :value="round.round.toString()"
                      v-for="round of currentMap.rounds"
                    >
                      Round {{ round.round.toString() }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button type="submit"> Restore Round </Button>
        </form>
      </RconCommander>
    </TabsContent>
    <TabsContent value="settings">
      <Card class="p-3 w-full sm:max-w-[500px]">
        <CardContent>
          <ul class="space-y-4">
            <li class="flex items-center justify-between">
              <span class="text-muted-foreground">Max Rounds</span>
              <span>{{ match.options.mr }}</span>
            </li>
            <li class="flex items-center justify-between">
              <span class="text-muted-foreground">TV Delay</span>
              <span>{{ match.options.tv_delay }} seconds</span>
            </li>
            <li class="flex items-center justify-between">
              <span class="text-muted-foreground">Coaches</span>
              <BooleanToText :value="match.options.coaches" />
            </li>
            <li class="flex items-center justify-between">
              <span class="text-muted-foreground">Overtime</span>
              <BooleanToText :value="match.options.overtime" />
            </li>
            <li class="flex items-center justify-between">
              <span class="text-muted-foreground">Knife Round</span>
              <BooleanToText :value="match.options.knife_round" />
            </li>
            <li class="flex items-center justify-between">
              <span class="text-muted-foreground">Map Veto</span>
              <BooleanToText :value="match.options.map_veto" />
            </li>
            <li class="flex items-center justify-between">
              <span class="text-muted-foreground">Region Veto</span>
              <BooleanToText :value="match.options.region_veto" />
            </li>
            <li class="flex items-center justify-between">
              <span class="text-muted-foreground">Map Pool</span>
              <span class="text-right">
                {{ separateByCapitalLetters(match.options.map_pool.type) }}
                <br />
                <small>
                  {{ match.options.map_pool.e_type.description }}
                </small>
              </span>
            </li>
            <li class="flex items-center justify-between">
              <span class="text-muted-foreground">Substitutes</span>
              <span>{{ match.options.number_of_substitutes }}</span>
            </li>
          </ul>

          <template v-if="displayServerInformation">
            <Separator class="my-8" />

            <div class="space-y-4">
              <h3 class="font-semibold">Server Information</h3>
              <ul class="space-y-3">
                <li class="flex items-center justify-between">
                  <span class="text-muted-foreground">Type</span>
                  <span>{{ match.server_type || "TBD" }}</span>
                </li>
                <li class="flex items-center justify-between">
                  <span class="text-muted-foreground">Region</span>
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
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            round: z.string(),
          }),
        ),
      }),
    };
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
  },
};
</script>
