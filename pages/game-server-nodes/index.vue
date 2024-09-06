<script setup lang="ts">
import { Button } from "~/components/ui/button";
import PageHeading from "~/components/PageHeading.vue";
import GameServerNodeRow from "~/components/game-server-nodes/GameServerNodeRow.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
</script>

<template>
  <PageHeading>
    Game Server Nodes
    <NuxtLink to="/game-server-nodes/create">
      <Button>Create Game Server Node</Button>
    </NuxtLink>
  </PageHeading>

  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Node</TableHead>
        <TableHead>Public IP</TableHead>
        <TableHead>Region</TableHead>
        <TableHead>Capacity</TableHead>
        <TableHead>
          <div class="flex">
            Ports
            <FiveStackToolTip>Forwarded Ports to Node</FiveStackToolTip>
          </div>
        </TableHead>
        <TableHead>Enabled</TableHead>
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
        <GameServerNodeRow
          :game-server-node="gameServerNode"
          :key="gameServerNode.id"
          v-for="gameServerNode of gameServerNodes"
        ></GameServerNodeRow>
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
              id: true,
              status: true,
              region: true,
              enabled: true,
              build_id: true,
              public_ip: true,
              start_port_range: true,
              end_port_range: true,
              e_region: {
                description: true,
              },
              e_status: {
                description: true,
              },
              total_server_count: true,
              available_server_count: true,
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
