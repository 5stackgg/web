<script lang="ts" setup>
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "~/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Cross2Icon } from "@radix-icons/vue";
import LineupOverview from "~/components/match/LineupOverview.vue";
import LineupUtility from "~/components/match/LineupUtility.vue";
import LineupOpeningDuels from "~/components/match/LineupOpeningDuels.vue";
import LineupClutches from "~/components/match/LineupClutches.vue";
import cleanMapName from "~/utilities/cleanMapName";
</script>

<template>
  <Drawer :open="open" @update:open="(v: boolean) => $emit('update:open', v)">
    <DrawerContent class="h-[80vh] max-h-[80vh]">
      <DrawerHeader class="flex items-center justify-between">
        <DrawerTitle>
          {{ cleanMapName(matchMap.map.name) }} — {{ match.lineup_1.name }}
          {{ matchMap.lineup_1_score }} : {{ matchMap.lineup_2_score }}
          {{ match.lineup_2.name }}
        </DrawerTitle>
        <DrawerClose as-child>
          <Button variant="ghost" size="icon">
            <Cross2Icon class="w-4 h-4" />
            <span class="sr-only">{{ $t("common.close") }}</span>
          </Button>
        </DrawerClose>
      </DrawerHeader>

      <div class="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <template v-if="mapStats">
          <Tabs default-value="overview">
            <TabsList variant="underline" class="h-auto flex-nowrap">
              <TabsTrigger value="overview">
                {{ $t("match.tabs.overview") }}
              </TabsTrigger>
              <TabsTrigger value="utility">
                {{ $t("match.tabs.utility") }}
              </TabsTrigger>
              <TabsTrigger value="opening-duels">
                {{ $t("match.tabs.opening_duels") }}
              </TabsTrigger>
              <TabsTrigger value="clutches">
                {{ $t("match.tabs.clutches") }}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div class="grid gap-4">
                <Card class="overflow-x-auto">
                  <CardContent class="py-2">
                    <LineupOverview
                      :match="scopedMatch"
                      :lineup="mapStats.lineup_1"
                    />
                  </CardContent>
                </Card>
                <Card class="overflow-x-auto">
                  <CardContent class="py-2">
                    <LineupOverview
                      :match="scopedMatch"
                      :lineup="mapStats.lineup_2"
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="utility">
              <div class="grid gap-4">
                <Card class="overflow-x-auto">
                  <CardContent class="py-2">
                    <LineupUtility
                      :match="scopedMatch"
                      :lineup="mapStats.lineup_1"
                    />
                  </CardContent>
                </Card>
                <Card class="overflow-x-auto">
                  <CardContent class="py-2">
                    <LineupUtility
                      :match="scopedMatch"
                      :lineup="mapStats.lineup_2"
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="opening-duels">
              <div class="grid gap-4">
                <Card class="overflow-x-auto">
                  <CardContent class="py-2">
                    <LineupOpeningDuels
                      :match="match"
                      :lineup="match.lineup_1"
                      :selected-map-id="matchMap.id"
                    />
                  </CardContent>
                </Card>
                <Card class="overflow-x-auto">
                  <CardContent class="py-2">
                    <LineupOpeningDuels
                      :match="match"
                      :lineup="match.lineup_2"
                      :selected-map-id="matchMap.id"
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="clutches">
              <Card class="overflow-x-auto">
                <CardContent class="py-2">
                  <LineupClutches
                    :match="match"
                    :lineup1="match.lineup_1"
                    :lineup2="match.lineup_2"
                    :selected-map-id="matchMap.id"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </template>

        <div v-else class="flex flex-col gap-3 py-4">
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-24 w-full" />
          <Skeleton class="h-24 w-full" />
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { matchMapStats } from "~/graphql/matchMapStatsGraphql";

export default {
  emits: ["update:open"],
  props: {
    open: {
      type: Boolean,
      default: false,
    },
    match: {
      type: Object,
      required: true,
    },
    matchMap: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      mapStats: null as null | {
        lineup_1: unknown;
        lineup_2: unknown;
      },
      loading: false,
    };
  },
  computed: {
    scopedMatch() {
      return {
        ...this.match,
        match_maps: [this.matchMap],
      };
    },
  },
  watch: {
    open: {
      immediate: true,
      handler(isOpen: boolean) {
        if (isOpen) {
          void this.fetchStats();
        } else {
          this.mapStats = null;
        }
      },
    },
    "matchMap.id"() {
      if (this.open) {
        void this.fetchStats();
      }
    },
  },
  methods: {
    async fetchStats() {
      this.loading = true;
      this.mapStats = null;
      try {
        const { data } = await this.$apollo.query({
          variables: {
            matchId: this.match.id,
            matchMapId: this.matchMap.id,
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
        this.mapStats = data?.matches_by_pk ?? null;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
