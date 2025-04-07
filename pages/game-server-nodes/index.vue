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
      <template #title>{{ $t("pages.game_server_nodes.title") }}</template>

      <template #description>{{
        $t("pages.game_server_nodes.description")
      }}</template>
      <template #actions>
        <Popover>
          <PopoverTrigger class="flex gap-4">
            <template v-if="!supportsGameServerNodes">
              <Alert class="bg-background text-lg">
                <Info class="h-4 w-4" />
                <AlertTitle>{{
                  $t("pages.game_server_nodes.not_supported.title")
                }}</AlertTitle>
                <AlertDescription>
                  {{ $t("pages.game_server_nodes.not_supported.description") }}
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
              <span class="hidden md:inline ml-2">{{
                $t("pages.game_server_nodes.create")
              }}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <div class="relative bg-gray-900 rounded-lg p-4" v-if="script">
              <div class="flex justify-between items-start mb-2">
                <h3 class="text-white text-sm font-semibold">
                  {{ $t("pages.game_server_nodes.installation_script") }}
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

    <Alert class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <Info class="h-4 w-4" />
        <AlertTitle class="m-0">{{
          $t("pages.game_server_nodes.cs_version_info")
        }}</AlertTitle>
      </div>
      <AlertDescription class="m-0 flex items-center gap-2">
        <span>{{
          $t("pages.game_server_nodes.build_id", { id: csVersion })
        }}</span>
        <span class="text-muted-foreground">•</span>
        <span>{{
          $t("pages.game_server_nodes.last_updated", {
            date: csVersionLastUpdated?.toLocaleString(),
          })
        }}</span>
      </AlertDescription>
    </Alert>

    <Card class="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{
              $t("pages.game_server_nodes.table.node")
            }}</TableHead>
            <TableHead>{{
              $t("pages.game_server_nodes.table.lan_public_ip")
            }}</TableHead>
            <TableHead>{{
              $t("pages.game_server_nodes.table.cs_build_id")
            }}</TableHead>
            <TableHead>{{
              $t("pages.game_server_nodes.table.region")
            }}</TableHead>
            <TableHead>{{
              $t("pages.game_server_nodes.table.capacity")
            }}</TableHead>
            <TableHead>
              <div class="flex items-center gap-1">
                {{ $t("pages.game_server_nodes.table.ports") }}
                <FiveStackToolTip>{{
                  $t("pages.game_server_nodes.table.ports_tooltip")
                }}</FiveStackToolTip>
              </div>
            </TableHead>
            <TableHead>{{
              $t("pages.game_server_nodes.table.enabled")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="gameServerNodes?.length === 0">
            <TableRow>
              <TableCell colspan="5" class="text-center">{{
                $t("pages.game_server_nodes.table.no_nodes")
              }}</TableCell>
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
    csVersion() {
      return useApplicationSettingsStore().csBuildInfo?.buildid;
    },
    csVersionLastUpdated() {
      return new Date(
        useApplicationSettingsStore().csBuildInfo?.timeupdated * 1000,
      );
    },
  },
};
</script>
