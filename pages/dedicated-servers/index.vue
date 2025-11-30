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
import ServerStatus from "~/components/servers/ServerStatus.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";

const { isMobile } = useSidebar();
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title> {{ $t("pages.dedicated_servers.title") }} </template>

      <template #description>
        {{ $t("pages.dedicated_servers.description") }}
        <a href="https://github.com/5stackgg/game-server"
          >https://github.com/5stackgg/game-server</a
        >.
      </template>

      <template #actions>
        <NuxtLink :to="{ name: 'dedicated-servers-create' }">
          <Button :size="isMobile ? 'default' : 'lg'">
            <PlusCircle class="w-4 h-4" />
            <span class="hidden md:inline ml-2">{{
              $t("pages.dedicated_servers.create.title")
            }}</span>
          </Button>
        </NuxtLink>
      </template>
    </PageHeading>

    <Card class="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{
              $t("pages.dedicated_servers.table.connection_details")
            }}</TableHead>
            <TableHead>{{
              $t("pages.dedicated_servers.table.label")
            }}</TableHead>
            <TableHead>{{
              $t("pages.dedicated_servers.table.type")
            }}</TableHead>
            <TableHead>{{
              $t("pages.dedicated_servers.table.region")
            }}</TableHead>
            <TableHead>{{
              $t("pages.dedicated_servers.table.plugin_version")
            }}</TableHead>
            <TableHead>{{
              $t("pages.dedicated_servers.table.tv_port")
            }}</TableHead>
            <TableHead>{{
              $t("pages.dedicated_servers.table.enabled")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="server of servers"
            :key="server.id"
            class="cursor-pointer"
          >
            <NuxtLink
              :to="{ name: 'dedicated-servers-id', params: { id: server.id } }"
              class="contents"
            >
              <TableCell>
                <div class="flex gap-2 items-center">
                  <ServerStatus :server="server" />
                  <span class="truncate">
                    {{ server.host }}
                  </span>
                </div>
              </TableCell>
              <TableCell>{{ server.label }}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {{ server.type }}
                </Badge>
              </TableCell>
              <TableCell>{{ server.region }}</TableCell>
              <TableCell>
                <template v-if="server.plugin_version">
                  v{{ server.plugin_version }}
                </template>
                <template v-else> - </template>
              </TableCell>
              <TableCell>{{ server.tv_port }}</TableCell>
              <TableCell>{{
                server.enabled
                  ? $t("pages.dedicated_servers.table.yes")
                  : $t("pages.dedicated_servers.table.no")
              }}</TableCell>
            </NuxtLink>
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
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
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
        query: generateSubscription({
          servers: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
            },
            {
              id: true,
              host: true,
              type: true,
              port: true,
              label: true,
              region: true,
              tv_port: true,
              enabled: true,
              connected: true,
              rcon_status: true,
              max_players: true,
              plugin_version: true,
              connect_password: true,
              offline_at: true,
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
};
</script>
