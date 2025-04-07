<script lang="ts" setup>
import { e_match_types_enum } from "~/generated/zeus";
import TimeAgo from "../TimeAgo.vue";
</script>
<template>
  <Card>
    <CardHeader
      class="flex justify-between items-center"
      v-if="regions.length > 1 || joinedQueue"
    >
      <CardTitle v-if="regions.length > 1">
        <Badge varient="outline">{{ region.description }}</Badge>
      </CardTitle>
      <div v-if="joinedQueue">
        <Button size="sm" variant="outline" @click="leaveMatchmaking()">
          {{ $t("matchmaking.leave") }}
        </Button>
      </div>
    </CardHeader>
    <CardContent
      :class="{
        'mt-6': regions.length <= 1 && !joinedQueue,
      }"
    >
      <div v-if="joinedQueue" class="mb-4 flex flex-col items-center">
        <div class="text-4xl font-bold">
          {{ matchMakingQueueDetails.regionPositions[region.value] }}
        </div>
        <div class="text-sm text-muted-foreground">
          {{ $t("matchmaking.position") }}
        </div>

        <small>
          <TimeAgo :date="matchMakingQueueDetails.joinedAt"></TimeAgo>
        </small>

        <div class="mt-2">
          <Badge>
            {{ matchMakingQueueDetails.type }}
          </Badge>
        </div>
      </div>
      <div class="space-y-2" v-if="!joinedQueue">
        <div
          v-for="matchType in e_match_types"
          :key="matchType.value"
          class="bg-secondary p-2 rounded-lg flex items-center justify-between"
        >
          <span class="text-sm font-medium">{{ matchType.value }}</span>
          <div class="flex items-center">
            <Badge variant="secondary" class="mr-2">
              {{ regionStats[region.value]?.[matchType.value] || 0 }}
            </Badge>
            <Button
              size="sm"
              @click="joinMatchmaking(matchType.value, region.value)"
            >
              {{ $t("matchmaking.join") }}
            </Button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import socket from "~/web-sockets/Socket";
import { generateQuery } from "~/graphql/graphqlGen";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

interface MatchType {
  value: e_match_types_enum;
  description: string;
}

export default {
  props: {
    region: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      e_match_types: [] as MatchType[],
    };
  },
  apollo: {
    e_match_types: {
      query: generateQuery({
        e_match_types: [
          {
            where: {
              value: {
                _in: [
                  e_match_types_enum.Competitive,
                  e_match_types_enum.Wingman,
                  e_match_types_enum.Duel,
                ],
              },
            },
          },
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
  },
  methods: {
    joinMatchmaking(type: e_match_types_enum, region: string) {
      socket.event("matchmaking:join-queue", {
        type,
        regions: [region],
      });
    },
    leaveMatchmaking() {
      socket.leave("matchmaking");
    },
  },
  computed: {
    isInQueue() {
      return this.matchMakingQueueDetails;
    },
    regionStats() {
      return useMatchmakingStore().regionStats;
    },
    matchMakingQueueDetails() {
      return useMatchmakingStore().joinedMatchmakingQueues.details;
    },
    joinedQueue() {
      return this.matchMakingQueueDetails;
    },
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
  },
};
</script>
