<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Pagination from "@/components/Pagination.vue";
import PageHeading from "~/components/PageHeading.vue";
import { PlusCircle } from "lucide-vue-next";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title> Dedicated Servers </template>

      <template #description>
        You can set up a dedicated server that will always run the game server
        mod
        <a href="https://github.com/5stackgg/game-server"
          >https://github.com/5stackgg/game-server</a
        >.
      </template>

      <template #actions>
        <NuxtLink :to="{ name: 'dedicated-servers-create' }">
          <Button size="lg">
            <PlusCircle class="w-4 h-4" />
            <span class="hidden md:inline ml-2">Create Dedicated Server</span>
          </Button>
        </NuxtLink>
      </template>
    </PageHeading>

    <Card class="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Connection Details</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>TV Port</TableHead>
            <TableHead>Enabled</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="server of servers"
            :key="server.id"
            @click="viewServer(server.id)"
            class="cursor-pointer"
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
                    class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-red-600"
                    v-if="!server.connected"
                  ></span>
                </div>
                <span class="truncate">
                  {{ server.host }}
                </span>
              </div>
            </TableCell>
            <TableCell>{{ server.label }}</TableCell>
            <TableCell>{{ server.region }}</TableCell>
            <TableCell>{{ server.tv_port }}</TableCell>
            <TableCell>{{ server.enabled ? "Yes" : "No" }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <Pagination
      :page="page"
      :per-page="perPage"
      @page="
        (_page) => {
          page = _page;
        }
      "
      :total="servers_aggregate.aggregate.count"
      v-if="servers_aggregate"
    ></Pagination>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      servers: undefined,
    };
  },
  apollo: {
    $subscribe: {
      servers: {
        query: generateQuery({
          servers: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
            },
            {
              id: true,
              host: true,
              port: true,
              label: true,
              region: true,
              tv_port: true,
              enabled: true,
              connected: true,
              current_match: {
                id: true,
              },
            },
          ],
        }),
        variables: function () {
          return {
            limit: this.perPage,
            offset: (this.page - 1) * this.perPage,
          };
        },
        result: function ({ data }) {
          this.servers = data.servers;
        },
      },
    },
    servers_aggregate: {
      query: generateQuery({
        servers_aggregate: [
          {},
          {
            aggregate: {
              count: true,
            },
          },
        ],
      }),
    },
  },
  methods: {
    viewServer(serverId) {
      this.$router.push(`/dedicated-servers/${serverId}`);
    },
  },
};
</script>
