<script lang="ts" setup>
import {
  e_match_types_enum,
  e_game_server_node_regions_enum,
} from "~/generated/zeus";
import socket from "~/web-sockets/Socket";
</script>
<template>
  <Card
    class="mb-4 w-64 inline-block mr-4 relative"
    v-if="!confirmationDetails?.matchId"
  >
    <CardHeader>
      <CardTitle class="text-lg">
        {{ region.description }}

        <div
          v-if="joinedCompetitiveQueue || joinedWingmanQueue"
          class="absolute top-3 right-3"
        >
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
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div
        v-if="joinedCompetitiveQueue || joinedWingmanQueue"
        class="mb-4 text-center"
      >
        <div class="text-4xl font-bold">
          {{ matchamkingQueueDetails.currentPosition }}
        </div>
        <div class="text-sm text-muted-foreground">Current Position</div>

        <small>
          <TimeAgo :date="matchamkingQueueDetails.joinedAt"></TimeAgo>
        </small>

        <div class="absolute bottom-3 left-1/2 transform -translate-x-1/2">
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

  <template v-else> Match Details </template>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import TimeAgo from "../TimeAgo.vue";

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
  watch: {
    confirmationDetails: {
      immediate: true,
      handler() {
        // this.match = this.confirmationDetails?.matchId;
        // TODO - get match
      },
    },
  },
  data() {
    return {
      match: null,
    };
  },
  methods: {
    joinMatchMaking(
      type: e_match_types_enum,
      region: e_game_server_node_regions_enum,
    ) {
      socket.event("match-making:join-queue", {
        type,
        regions: [region],
      });
    },
    leaveMatchMaking(
      type: e_match_types_enum,
      region: e_game_server_node_regions_enum,
    ) {
      socket.leave("match-making", {
        type,
        region,
      });
    },
  },
  computed: {
    isInQueue() {
      return this.matchamkingQueueDetails;
    },
    regionStats() {
      return useMatchMakingStore().regionStats;
    },
    confirmationDetails() {
      return useMatchMakingStore().joinedMatchmakingQueues.confirmation;
    },
    matchamkingQueueDetails() {
      return useMatchMakingStore().joinedMatchmakingQueues.details;
    },
    joinedWingmanQueue() {
      return (
        this.matchamkingQueueDetails?.type === e_match_types_enum.Wingman &&
        this.matchamkingQueueDetails?.regions.includes(this.region.value)
      );
    },
    joinedCompetitiveQueue() {
      return (
        this.matchamkingQueueDetails?.type === e_match_types_enum.Competitive &&
        this.matchamkingQueueDetails?.regions.includes(this.region.value)
      );
    },
  },
};
</script>
