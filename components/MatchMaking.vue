<script lang="ts" setup></script>

<template>
  <div>
    <template v-for="region in regions">
      <Card class="mb-4 w-64 inline-block mr-4">
        <CardHeader>
          <CardTitle class="text-lg">
            {{ region.description }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul class="space-y-2">
            <li
              v-for="type in e_match_types"
              :key="type.value"
              class="flex justify-between items-center"
            >
              <span class="text-sm font-medium">{{ type.value }}</span>
              <span class="text-sm">{{
                regionStats[region.value]?.[type.value] || 0
              }}</span>

              <template
                v-if="
                  joinedMatchmakingQueues.some(
                    (queue) =>
                      queue.region === region.value &&
                      queue.type === type.value,
                  )
                "
              >
                <Badge variant="success" class="ml-2 text-xs"> Joined </Badge>
              </template>
              <template v-else>
                <Button
                  size="sm"
                  variant="outline"
                  @click="joinMatchMaking(type.value, region.value)"
                  >Join</Button
                >
              </template>
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

<script lang="ts">
import socket from "~/web-sockets/Socket";
import { e_match_types_enum } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { generateQuery } from "~/graphql/graphqlGen";
import { useMatchMakingStore } from "~/stores/MatchMakingStore";

export default {
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
    $subscribe: {
      e_game_server_node_regions: {
        query: typedGql("subscription")({
          e_game_server_node_regions: [
            {
              where: {
                game_server_nodes: {
                  enabled: {
                    _eq: true,
                  },
                },
                game_server_nodes_aggregate: {
                  count: {
                    predicate: {
                      _gt: 0,
                    },
                  },
                },
              },
            },
            {
              value: true,
              description: true,
            },
          ],
        }),
        result({ data }) {
          this.regions = data.e_game_server_node_regions;
        },
      },
    },
  },
  data() {
    return {
      regions: undefined,
      matchmakingDialog: false,
      matchmakingDetails: undefined,
    };
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
  },
};
</script>
