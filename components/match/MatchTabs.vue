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
import { Input } from "~/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";

const commander = new EventEmitter();
provide("commander", commander);
</script>

<template>
  <Tabs default-value="overview">
    <div class="flex items-center">
      <TabsList>
        <TabsTrigger value="overview"> Overview </TabsTrigger>
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
      <rcon-commander :server-id="match.server_id" v-slot="{ commander }">
        <template v-for="command of availableCommands">
          <template v-if="command.input">
            <!-- TDOO: there is an issue where nested form does not get updated properly -->
            <form @submit.prevent="handleCommand(commander, command)">
              <FormField v-slot="{ componentField }" name="round">
                <FormItem>
                  <FormLabel>Reset Round</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      @update:model-value="
                        (value) => form.setFieldValue('round', value)
                      "
                      v-bind="componentField"
                    />
                  </FormControl>
                </FormItem>
                <p v-if="form.errors.round" class="text-red-500">
                  {{ form.errors.round }}
                </p>
              </FormField>

              <Button type="submit">
                {{ command.display }}
              </Button>
            </form>
          </template>
          <template v-else>
            <Button @click="handleCommand(commander, command)">{{
              command.display
            }}</Button>
          </template>
        </template>
      </rcon-commander>
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
  RestoreRound = "restore_round",
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
  [AvailableCommands.RestoreRound]: {
    input: true,
    type: "number",
    display: "Restore a Round",
    value: AvailableCommands.RestoreRound,
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
            round: z.number(),
          }),
        ),
      }),
    };
  },
  computed: {
    disableStats() {
      return [
        e_match_map_status_enum.PickingPlayers,
        e_match_map_status_enum.Scheduled,
        e_match_map_status_enum.Veto,
        e_match_map_status_enum.WaitingForCheckIn,
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
          commands.push(CommandDetails[AvailableCommands.RestoreRound]);
          break;
        case e_match_map_status_enum.Live:
        case e_match_map_status_enum.Overtime:
          commands.push(CommandDetails[AvailableCommands.Pause]);
          commands.push(CommandDetails[AvailableCommands.RestoreRound]);
          break;
      }

      return commands;
    },
  },
  methods: {
    async handleCommand(commander, command: string) {
      if (command.input === true) {
        const { valid } = await this.form.validate();

        if (!valid) {
          return;
        }
        commander(command.value, this.form.values.round.toString());

        return;
      }
      commander(command.value);
    },
  },
};
</script>
