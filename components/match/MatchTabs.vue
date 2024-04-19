<script lang="ts" setup>
import {Tabs, TabsContent, TabsList, TabsTrigger} from "~/components/ui/tabs";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger
} from "~/components/ui/dropdown-menu";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "~/components/ui/table";
import {File, ListFilter} from "lucide-vue-next";
import {Badge} from "~/components/ui/badge";
import {Checkbox} from "~/components/ui/checkbox";
import {Button} from "~/components/ui/button";
import LineupOverview from "~/components/match/LineupOverview.vue";

</script>
<template>
  <Tabs default-value="overview">
    <div class="flex items-center">
      <TabsList>
        <TabsTrigger value="overview">
          Overview
        </TabsTrigger>
        <TabsTrigger value="utility">
          Utility
        </TabsTrigger>
        <TabsTrigger value="opening-duels">
          Opening Duels
        </TabsTrigger>
        <TabsTrigger value="clutches">
          Clutches
        </TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="overview">
      <Card>
        <CardHeader class="px-7">
          <CardTitle>Match Overview</CardTitle>
          <CardDescription>
            Overview of basic stats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <lineup-overview
              :match="match"
              :lineup="matchLineups.lineup1"
          ></lineup-overview>

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
          <CardDescription>
            Utility usage per player
          </CardDescription>
        </CardHeader>
        <CardContent>
          <match-lineup-utility
              :match="match"
              :lineup="matchLineups.lineup1"
          ></match-lineup-utility>
          <match-lineup-utility
              :match="match"
              :lineup="matchLineups.lineup2"
          ></match-lineup-utility>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="opening-duels"></TabsContent>
    <TabsContent value="clutches"></TabsContent>
  </Tabs>
<!--    <tab title="">-->
<!--      <lineup-opening-duels-->
<!--        :match="match"-->
<!--        :lineup="matchLineups.lineup1"-->
<!--      ></lineup-opening-duels>-->
<!--      <br />-->
<!--      <lineup-opening-duels-->
<!--        :match="match"-->
<!--        :lineup="matchLineups.lineup2"-->
<!--      ></lineup-opening-duels>-->
<!--    </tab>-->
<!--    <tab title="Clutches">-->
<!--      <lineup-clutches-->
<!--        :match="match"-->
<!--        :lineup1="matchLineups.lineup1"-->
<!--        :lineup2="matchLineups.lineup2"-->
<!--      ></lineup-clutches>-->
<!--    </tab>-->
<!--  </tabs>-->
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
