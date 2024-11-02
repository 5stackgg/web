<script setup lang="ts">
import { Button } from "~/components/ui/button";
import PageHeading from "~/components/PageHeading.vue";
import GameServerNodeRow from "~/components/game-server-nodes/GameServerNodeRow.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { PlusCircle } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import { Info } from "lucide-vue-next";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title> Game Server Nodes </template>

      <template #description
        >Game server nodes expand your server offerings into different regions
        or provide redundancy for on-demand servers.
      </template>
      <template #actions>
        <Popover>
          <PopoverTrigger class="flex gap-4">
            <template v-if="!supportsGameServerNodes">
              <Alert class="bg-background text-lg">
                <Info class="h-4 w-4" />
                <AlertTitle
                  >Your Panel currently does not support Game Server
                  Nodes.</AlertTitle
                >
                <AlertDescription>
                  View the documentation to setup
                  <a
                    target="_blank"
                    class="underline"
                    href="https://docs.5stack.gg/servers/game-server-nodes/"
                    >Game Server Nodes</a
                  >.
                </AlertDescription>
              </Alert>
            </template>

            <Button
              size="lg"
              @click="createGameServerNode"
              :disabled="!supportsGameServerNodes"
            >
              <PlusCircle class="w-4 h-4" />
              <span class="hidden md:inline ml-2">Create Game Server Node</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <div class="relative bg-gray-900 rounded-lg p-4" v-if="script">
              <div class="flex justify-between items-start mb-2">
                <h3 class="text-white text-sm font-semibold">
                  Installation Script
                </h3>
                <ClipBoard
                  :data="script"
                  class="text-white hover:text-gray-300 transition-colors"
                ></ClipBoard>
              </div>
              <pre class="text-white overflow-x-auto text-sm">{{ script }}</pre>
            </div>
          </PopoverContent>
        </Popover>
      </template>
    </PageHeading>

    <Card class="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Node</TableHead>
            <TableHead>Lan/Public IP</TableHead>
            <TableHead>CS Build ID</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>
              <div class="flex items-center gap-1">
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
    </Card>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  data() {
    return {
      script: undefined,
      gameServerNodes: [],
    };
  },
  apollo: {
    $subscribe: {
      game_server_nodes: {
        query: typedGql("subscription")({
          game_server_nodes: [
            {
              order_by: [
                {},
                {
                  id: order_by.asc,
                },
              ],
            },
            {
              id: true,
              status: true,
              region: true,
              enabled: true,
              build_id: true,
              lan_ip: true,
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
  methods: {
    async createGameServerNode() {
      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          setupGameServer: {
            link: true,
          },
        }),
      });

      this.script = data.setupGameServer.link;
    },
  },
  computed: {
    supportsGameServerNodes() {
      return useApplicationSettingsStore().supportsGameServerNodes;
    },
  },
};
</script>
