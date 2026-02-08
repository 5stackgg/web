<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import PageHeading from "~/components/PageHeading.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { e_server_types_enum } from "~/generated/zeus";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
</script>

<template>
  <PageTransition :delay="0">
    <PageHeading>
      <template #title> {{ $t("pages.public_servers.title") }} </template>
      <template #description>
        {{ $t("pages.public_servers.description") }}
      </template>
    </PageHeading>
  </PageTransition>

  <PageTransition :delay="100">
    <div class="mt-6">
      <AnimatedCard variant="gradient" class="p-4">
        <Transition name="fade" mode="out-in">
          <Empty v-if="loading" key="loading" class="min-h-[200px]">
            <div class="space-y-3 w-full max-w-md">
              <Skeleton class="h-4 w-3/4 mx-auto" />
              <Skeleton class="h-3 w-full" />
              <Skeleton class="h-3 w-5/6 mx-auto" />
            </div>
          </Empty>

          <Table
            v-else-if="servers && (servers as any[]).length > 0"
            key="servers"
          >
            <TableHeader>
              <TableRow>
                <TableHead>{{
                  $t("pages.public_servers.table.label")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.map")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.players")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.region")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.type")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.connect")
                }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="server of servers"
                :key="server.id"
                class="cursor-pointer hover:bg-muted/50"
              >
                <TableCell>
                  <div class="flex gap-2 items-center">
                    <div
                      class="h-2 w-2 rounded-full relative"
                      :class="{
                        'bg-red-600': !server.connected,

                        'bg-green-600': server.connected,
                      }"
                    >
                      <span
                        class="animate-ping absolute left-0 h-2 w-2 rounded-full opacity-75"
                        :class="{
                          'bg-red-600': !server.connected,
                        }"
                        v-if="!server.connected"
                      ></span>
                    </div>
                    <span class="truncate font-mono text-sm">
                      {{ server.label }}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {{ getDedicatedServerMap(server.id) }}
                </TableCell>
                <TableCell>
                  {{ getDedicatedServerPlayers(server.id) }} /
                  {{ server.max_players }}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ server.region }}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {{ server.type }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <QuickServerConnect :server="server" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Empty v-else key="empty" class="min-h-[200px]">
            <EmptyTitle>{{
              $t("pages.public_servers.no_servers_title")
            }}</EmptyTitle>
            <EmptyDescription>{{
              $t("pages.public_servers.no_public_servers")
            }}</EmptyDescription>
          </Empty>
        </Transition>
      </AnimatedCard>
    </div>
  </PageTransition>

  <!-- LAN Servers Table -->
  <PageTransition :delay="200">
    <div v-if="!loading && lanServers && lanServers.length > 0" class="mt-6">
      <h2 class="text-xl font-semibold mb-4">
        {{ $t("pages.public_servers.lan_servers_title") }}
      </h2>
      <AnimatedCard variant="gradient" class="p-4">
        <Transition name="fade" mode="out-in">
          <Table key="lan-servers">
            <TableHeader>
              <TableRow>
                <TableHead>{{
                  $t("pages.public_servers.table.label")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.map")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.players")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.region")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.type")
                }}</TableHead>
                <TableHead>{{
                  $t("pages.public_servers.table.connect")
                }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="server of lanServers"
                :key="server.id"
                class="cursor-pointer hover:bg-muted/50"
              >
                <TableCell>
                  <div class="flex gap-2 items-center">
                    <div
                      class="h-2 w-2 rounded-full relative"
                      :class="{
                        'bg-red-600': !server.connected,
                        'bg-green-600': server.connected,
                      }"
                    >
                      <span
                        class="animate-ping absolute left-0 h-2 w-2 rounded-full opacity-75"
                        :class="{
                          'bg-red-600': !server.connected,
                        }"
                        v-if="!server.connected"
                      ></span>
                    </div>
                    <span class="truncate font-mono text-sm">
                      {{ server.label }}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {{ getDedicatedServerMap(server.id) }}
                </TableCell>
                <TableCell>
                  {{ getDedicatedServerPlayers(server.id) }} /
                  {{ server.max_players }}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ server.region }}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {{ server.type }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <QuickServerConnect :server="server" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Transition>
      </AnimatedCard>
    </div>
  </PageTransition>
</template>

<script lang="ts">
export default {
  data() {
    return {
      servers: undefined as any[] | undefined,
      lanServers: undefined as any[] | undefined,
      getDedicatedServerInfo: undefined as any[] | undefined,
      loading: true,
    };
  },
  apollo: {
    getDedicatedServerInfo: {
      query: generateQuery({
        getDedicatedServerInfo: [
          {},
          {
            id: true,
            map: true,
            players: true,
            lastPing: true,
          },
        ],
      }),
      pollInterval: 60 * 1000,
    },
    $subscribe: {
      servers: {
        query: generateSubscription({
          servers: [
            {
              where: {
                _and: [
                  {
                    _or: [
                      {
                        type: {
                          _neq: $("rankedType", "e_server_types_enum!"),
                        },
                      },
                      {
                        connection_string: {
                          _is_null: false,
                        },
                      },
                    ],
                  },
                  {
                    enabled: {
                      _eq: true,
                    },
                  },
                  {
                    connected: {
                      _eq: true,
                    },
                  },
                ],
              },
              order_by: [
                {
                  label: "asc" as any,
                },
              ],
            },
            {
              id: true,
              label: true,
              type: true,
              region: true,
              connected: true,
              connection_link: true,
              connection_string: true,
              max_players: true,
              server_region: {
                is_lan: true,
              },
            },
          ],
        }),
        variables: function () {
          return {
            rankedType: e_server_types_enum.Ranked,
          };
        },
        result: function ({ data }: { data: any }) {
          this.servers = data.servers.filter(
            (server: any) => !server.server_region.is_lan,
          );
          this.lanServers = data.servers.filter(
            (server: any) => server.server_region.is_lan,
          );
          this.loading = false;
        },
      },
    },
  },
  methods: {
    getDedicatedServerMap(id: string) {
      return this.getDedicatedServerInfo?.find((server) => {
        return server.id === id;
      })?.map;
    },
    getDedicatedServerPlayers(id: string) {
      return (
        this.getDedicatedServerInfo?.find((server) => {
          return server.id === id;
        })?.players || 0
      );
    },
  },
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
