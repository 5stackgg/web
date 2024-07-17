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
</script>

<template>
  <Tabs default-value="overview">
    <div class="flex items-center">
      <TabsList>
        <TabsTrigger value="overview"> Overview </TabsTrigger>
        <TabsTrigger value="utility"> Utility </TabsTrigger>
        <TabsTrigger value="opening-duels"> Opening Duels </TabsTrigger>
        <TabsTrigger value="clutches"> Clutches </TabsTrigger>
        <TabsTrigger value="server"> Server Console </TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="overview">
      <Card>
        <CardHeader class="px-7">
          <CardTitle>Match Overview</CardTitle>
          <CardDescription> Overview of basic stats </CardDescription>
        </CardHeader>
        <CardContent>
          <lineup-overview
            :match="match"
            :lineup="matchLineups.lineup1"
          ></lineup-overview>
        </CardContent>

        <CardContent>
          <lineup-overview
              :match="match"
              :lineup="matchLineups.lineup2"
          ></lineup-overview>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="utility">
      <Card>
        <CardHeader class="px-7">
          <CardTitle>Utility Usage</CardTitle>
          <CardDescription> Utility usage per player </CardDescription>
        </CardHeader>
        <CardContent>
          <lineup-utility
            :match="match"
            :lineup="matchLineups.lineup1"
          ></lineup-utility>
          <lineup-utility
            :match="match"
            :lineup="matchLineups.lineup2"
          ></lineup-utility>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="opening-duels">
      <Card>
        <CardHeader class="px-7">
          <CardTitle>Opening Duels</CardTitle>
          <CardDescription> Opening Duels </CardDescription>
        </CardHeader>
        <CardContent>
          <lineup-opening-duels
            :match="match"
            :lineup="matchLineups.lineup1"
          ></lineup-opening-duels>
          <lineup-opening-duels
            :match="match"
            :lineup="matchLineups.lineup2"
          ></lineup-opening-duels>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="clutches">
      <Card>
        <CardHeader class="px-7">
          <CardTitle>Clutches</CardTitle>
          <CardDescription> Clutches </CardDescription>
        </CardHeader>
        <CardContent>
          <lineup-clutches
            :match="match"
            :lineup1="matchLineups.lineup1"
            :lineup2="matchLineups.lineup2"
          ></lineup-clutches>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="server">
      <rcon-commander :server-id="match.server_id"></rcon-commander>
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import getMatchLineups from "~/utilities/getMatchLineups";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  computed: {
    matchLineups() {
      return getMatchLineups(this.match);
    },
  },
};
</script>
