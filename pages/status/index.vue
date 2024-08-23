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
      <template v-if="gameServerNodes?.length === 0">
        <TableRow>
          <TableCell colspan="5" class="text-center"
            >No Game Server Nodes</TableCell
          >
        </TableRow>
      </template>
      <template v-else>
        <GameServerNodeDisplay
          :game-server-node="gameServerNode"
          v-for="gameServerNode of gameServerNodes"
        ></GameServerNodeDisplay>
      </template>
    </TableBody>
  </Table>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  data() {
    return {
      gameServerNodes: [],
    };
  },
  apollo: {
    $subscribe: {
      game_server_nodes: {
        query: typedGql("subscription")({
          game_server_nodes: [
            {},
            {
              status: true,
              region: true,
              e_region: {
                description: true,
              },
              e_status: {
                description: true,
              },
            },
          ],
        }),
        result: function ({ data }) {
          this.gameServerNodes = data.game_server_nodes;
        },
      },
    },
  },
};
</script>
