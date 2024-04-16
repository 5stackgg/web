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
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <div class="space-y-0.5">
    <h2 class="text-2xl font-bold tracking-tight">Servers</h2>
    <p class="text-muted-foreground">Manage your dedicated servers servers</p>
  </div>
  <Separator class="my-6" />

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
    :total="Math.ceil(servers_aggregate.aggregate.count / perPage)"
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
    };
  },
  apollo: {
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
