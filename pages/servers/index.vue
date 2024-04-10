<template>
  <h1>Manage Servers</h1>
  <NuxtLink to="/servers/create">
    <five-stack-button>Create Server</five-stack-button>
  </NuxtLink>

  <clickable-table class="mt-2 mb-2">
    <thead>
      <tr>
        <th>Label</th>
        <th>Host/Port</th>
        <th>TV Port</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <template v-for="server of servers">
        <tr @click="viewServer(server.id)">
          <td>{{ server.label }}</td>
          <td>{{ server.host }}:{{ server.port }}</td>
          <td>{{ server.tv_port }}</td>
          <td>{{ server.enabled }}</td>
        </tr>
      </template>
    </tbody>
  </clickable-table>
  <pagination
    :page="page"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="Math.ceil(servers_aggregate.aggregate.count / per_page)"
    v-if="servers_aggregate"
  ></pagination>
</template>
<script setup lang="ts">
import FiveStackButton from "~/components/FiveStackButton.vue";
</script>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      per_page: 10,
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
          limit: this.per_page,
          offset: (this.page - 1) * this.per_page,
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
