<script lang="ts" setup>
import {
  e_match_types_enum,
  e_game_server_node_regions_enum,
} from "~/generated/zeus";
import socket from "~/web-sockets/Socket";
</script>
<template>
  <Card class="mb-4 w-64 inline-block mr-4 relative">
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
          {{
            joinedCompetitiveQueue
              ? joinedCompetitiveQueue.currentPosition
              : joinedWingmanQueue.currentPosition
          }}
        </div>
        <div class="text-sm text-muted-foreground">Current Position</div>

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
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";

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
    joinMatchMaking(
      type: e_match_types_enum,
      region: e_game_server_node_regions_enum,
    ) {
      socket.join("match-making", {
        type,
        region,
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
    confirmMatchMaking() {
      // socket.event("match-making:confirm", {
      //   matchId: this.matchId,
      // });
    },
  },
  computed: {
    regionStats() {
      return useMatchMakingStore().regionStats;
    },
    joinedMatchmakingQueues() {
      return useMatchMakingStore().joinedMatchmakingQueues;
    },
    joinedWingmanQueue() {
      return this.joinedMatchmakingQueues.find((queue) => {
        return (
          queue.region === this.region.value &&
          queue.type === e_match_types_enum.Wingman
        );
      });
    },
    joinedCompetitiveQueue() {
      return this.joinedMatchmakingQueues.find((queue) => {
        return (
          queue.region === this.region.value &&
          queue.type === e_match_types_enum.Competitive
        );
      });
    },
  },
};
</script>
