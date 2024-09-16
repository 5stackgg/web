<script lang="ts" setup>
import PageHeading from "~/components/PageHeading.vue";
import GameServerNodeDisplay from "~/components/game-server-nodes/GameServerNodeDisplay.vue";
</script>

<template>
  <PageHeading> 5Stack Status </PageHeading>

  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="text-left">Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="region in gameServerRegions" :key="region.value">
        <TableCell>
          <span
            class="ml-1 inline-block h-2 w-2 rounded-full"
            :class="{
              'bg-red-600': region.status === 'Offline',
              'bg-green-600': region.status === 'Online',
              'bg-yellow-600': region.status === 'Partial',
            }"
          >
          </span>
          {{ region.description }}
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  data() {
    return {
      gameServerRegions: [],
    };
  },
  apollo: {
    $subscribe: {
      game_server_nodes: {
        query: typedGql("subscription")({
          e_game_server_node_regions: [
            {
              where: {
                status: {
                  _neq: "N/A",
                },
              },
            },
            {
              value: true,
              status: true,
              description: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.gameServerRegions = data.e_game_server_node_regions;
        },
      },
    },
  },
};
</script>
