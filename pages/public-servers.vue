<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageHeading from "~/components/PageHeading.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { e_server_types_enum } from "~/generated/zeus";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title> {{ $t("pages.public_servers.title") }} </template>
      <template #description>
        {{ $t("pages.public_servers.description") }}
      </template>
    </PageHeading>

    <div>
      <Card class="p-4" v-if="servers && (servers as any[]).length > 0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{
                $t("pages.public_servers.table.label")
              }}</TableHead>
              <TableHead>{{ $t("pages.public_servers.table.map") }}</TableHead>
              <TableHead>{{
                $t("pages.public_servers.table.players")
              }}</TableHead>
              <TableHead>{{
                $t("pages.public_servers.table.region")
              }}</TableHead>
              <TableHead>{{ $t("pages.public_servers.table.type") }}</TableHead>
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
      </Card>

      <Card class="p-8 text-center" v-if="servers && servers.length === 0">
        <div class="flex flex-col items-center gap-4">
          <div class="text-muted-foreground">
            {{ $t("pages.public_servers.no_public_servers") }}
          </div>
        </div>
      </Card>
    </div>

    <!-- LAN Servers Table -->
    <div v-if="lanServers && lanServers.length > 0">
      <h2 class="text-xl font-semibold mb-4">
        {{ $t("pages.public_servers.lan_servers_title") }}
      </h2>
      <Card class="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{
                $t("pages.public_servers.table.label")
              }}</TableHead>
              <TableHead>{{ $t("pages.public_servers.table.map") }}</TableHead>
              <TableHead>{{
                $t("pages.public_servers.table.players")
              }}</TableHead>
              <TableHead>{{
                $t("pages.public_servers.table.region")
              }}</TableHead>
              <TableHead>{{ $t("pages.public_servers.table.type") }}</TableHead>
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
      </Card>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
      servers: undefined as any[] | undefined,
      lanServers: undefined as any[] | undefined,
      getDedicatedServerInfo: undefined as any[] | undefined,
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
