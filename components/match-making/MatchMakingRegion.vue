<script lang="ts" setup>
import { e_match_types_enum } from "~/generated/zeus";
import TimeAgo from "../TimeAgo.vue";
</script>
<template>
  <Card>
    <CardHeader
      class="flex justify-between items-center"
      v-if="regions.length > 1 || joinedCompetitiveQueue || joinedWingmanQueue"
    >
      <CardTitle v-if="regions.length > 1">
        <Badge varient="outline">{{ region.description }}</Badge>
      </CardTitle>
      <div v-if="joinedCompetitiveQueue || joinedWingmanQueue">
        <Button
          size="sm"
          variant="outline"
          @click="
            leaveMatchMaking(
              joinedCompetitiveQueue
                ? e_match_types_enum.Competitive
                : e_match_types_enum.Wingman,
              region.value,
            )
          "
        >
          Leave
        </Button>
      </div>
    </CardHeader>
    <CardContent
      :class="{
        'mt-6':
          regions.length <= 1 && !joinedCompetitiveQueue && !joinedWingmanQueue,
      }"
    >
      <div
        v-if="
          joinedCompetitiveQueue ||
          (joinedWingmanQueue && matchMakingQueueDetails)
        "
        class="mb-4 flex flex-col items-center"
      >
        <div class="text-4xl font-bold">
          {{ matchMakingQueueDetails.regionPositions[region.value] }}
        </div>
        <div class="text-sm text-muted-foreground">Current Position</div>

        <small>
          <TimeAgo :date="matchMakingQueueDetails.joinedAt"></TimeAgo>
        </small>

        <div class="mt-2">
          <Badge>
            {{ joinedCompetitiveQueue ? "Competitive" : "Wingman" }}
          </Badge>
        </div>
      </div>
      <div
        class="space-y-2"
        v-if="!joinedCompetitiveQueue && !joinedWingmanQueue"
      >
        <div
          class="bg-secondary p-2 rounded-lg flex items-center justify-between"
        >
          <span class="text-sm font-medium">{{
            e_match_types_enum.Competitive
          }}</span>
          <div class="flex items-center">
            <Badge variant="secondary" class="mr-2">
              {{
                regionStats[region.value]?.[e_match_types_enum.Competitive] || 0
              }}
            </Badge>
            <Button
              size="sm"
              @click="
                joinMatchMaking(e_match_types_enum.Competitive, region.value)
              "
            >
              Join
            </Button>
          </div>
        </div>
        <div
          class="bg-secondary p-2 rounded-lg flex items-center justify-between"
        >
          <span class="text-sm font-medium">{{
            e_match_types_enum.Wingman
          }}</span>
          <div class="flex items-center">
            <Badge variant="secondary" class="mr-2">
              {{ regionStats[region.value]?.[e_match_types_enum.Wingman] || 0 }}
            </Badge>
            <Button
              size="sm"
              @click="joinMatchMaking(e_match_types_enum.Wingman, region.value)"
            >
              Join
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
import { useMatchMakingStore } from "~/stores/MatchMakingStore";

export default {
  props: {
    region: {
      type: Object,
      required: true,
    },
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
    joinMatchMaking(type: e_match_types_enum, region: string) {
      socket.event("match-making:join-queue", {
        type,
        regions: [region],
      });
    },
    leaveMatchMaking(type: e_match_types_enum, region: string) {
      socket.leave("match-making", {
        type,
        region,
      });
    },
  },
  computed: {
    isInQueue() {
      return this.matchMakingQueueDetails;
    },
    regionStats() {
      return useMatchMakingStore().regionStats;
    },
    matchMakingQueueDetails() {
      return useMatchMakingStore().joinedMatchmakingQueues.details;
    },
    joinedWingmanQueue() {
      return (
        this.matchMakingQueueDetails?.type === e_match_types_enum.Wingman &&
        this.matchMakingQueueDetails?.regions.includes(this.region.value)
      );
    },
    joinedCompetitiveQueue() {
      return (
        this.matchMakingQueueDetails?.type === e_match_types_enum.Competitive &&
        this.matchMakingQueueDetails?.regions.includes(this.region.value)
      );
    },
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
  },
};
</script>
