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
</script>

<template>
  <PageHeading>
    Servers
    <NuxtLink to="/servers/create">
      <Button>Create Server</Button>
    </NuxtLink>

    <template v-slot:description>
      Manage your dedicated servers servers
    </template>
  </PageHeading>

  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Label</TableHead>
        <TableHead>Connection Details</TableHead>
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
        <TableCell>{{ server.label }}</TableCell>
        <TableCell>{{ server.host }}</TableCell>
        <TableCell>{{ server.tv_port }}</TableCell>
        <TableCell>{{ server.enabled }}</TableCell>
      </TableRow>
    </TableBody>
  </Table>

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
              tv_port: true,
              enabled: true,
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
      this.$router.push(`/servers/${serverId}`);
    },
  },
};
</script>
