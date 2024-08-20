<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import MatchMapSelection from "~/components/match/MatchMapSelection.vue";

const commander = new EventEmitter();
provide("commander", commander);
</script>

<template>
  <Tabs :default-value="defaultTab">
    <div class="flex items-center">
      <TabsList>
        <TabsTrigger value="overview"> Overview </TabsTrigger>
        <TabsTrigger class="block sm:hidden md:block lg:hidden" value="veto">
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
        <TabsTrigger :disabled="match.demos.length === 0" value="demos">
          Demos
        </TabsTrigger>
        <TabsTrigger :disabled="!match.server_id" value="server">
          Server Console
        </TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="overview">
      <Card>
        <CardHeader>
          <CardTitle>Match Overview</CardTitle>
          <CardDescription> Overview of basic stats </CardDescription>
        </CardHeader>
        <CardContent>
          <lineup-overview
            :match="match"
            :lineup="match.lineup_1"
          ></lineup-overview>
        </CardContent>

        <CardContent>
          <lineup-overview
            :match="match"
            :lineup="match.lineup_2"
          ></lineup-overview>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="veto">
      <Card>
        <CardHeader>
          <CardTitle>Map Veto</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchMapSelection :match="match"></MatchMapSelection>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="utility">
      <Card>
        <CardHeader>
          <CardTitle>Utility Usage</CardTitle>
          <CardDescription> Utility usage per player </CardDescription>
        </CardHeader>
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
        <CardHeader>
          <CardTitle>Opening Duels</CardTitle>
          <CardDescription> Opening Duels </CardDescription>
        </CardHeader>
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
        <CardHeader>
          <CardTitle>Clutches</CardTitle>
          <CardDescription> Clutches </CardDescription>
        </CardHeader>
        <CardContent>
          <lineup-clutches
            :match="match"
            :lineup1="match.lineup_1"
            :lineup2="match.lineup_2"
          ></lineup-clutches>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="demos">
      <pre>{{ match.demos }}</pre>
    </TabsContent>
    <TabsContent value="server">
      <RconCommander :server-id="match.server_id" v-slot="{ commander }">
        <template v-for="command of availableCommands">
          <Button @click="commander(command.value)">{{
            command.display
          }}</Button>
        </template>

        <form
          @submit.prevent="commander('restore_round', form.values.round)"
          v-if="currentMap?.rounds.length > 0"
        >
          <FormField v-slot="{ componentField }" name="round">
            <FormItem>
              <FormLabel>Match Type </FormLabel>
              <Select
                v-bind="componentField"
                @update:model-value="
                  (value) => form.setFieldValue('round', value)
                "
                >>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select the match type" />
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
    defaultTab() {
      return this.match.status === e_match_status_enum.Veto
        ? "veto"
        : "overview";
    },
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

      switch (this.currentMap.status) {
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
  },
};
</script>
