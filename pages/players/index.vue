<template>
  <h1>Players</h1>

  <form @submit.prevent>
    <five-stack-text-input
      label="Filter Players"
      v-model="playerQuery"
    ></five-stack-text-input>
  </form>
  <clickable-table class="mt-2 mb-2">
    <thead>
      <tr>
        <th>Name</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="player of players">
        <tr @click="viewPlayer(player.steam_id)">
          <td>{{ player.name }}</td>
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
    :total="Math.ceil(pagination.total / per_page)"
    v-if="pagination"
  ></pagination>
</template>
<script setup lang="ts">
import FiveStackTextInput from "~/components/forms/FiveStackTextInput.vue";
</script>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      per_page: 10,
      playerQuery: null,
      players: undefined,
      pagination: undefined,
    };
  },
  watch: {
    page: {
      immediate: true,
      handler() {
        this.searchPlayers();
      },
    },
    playerQuery: {
      handler() {
        this.searchPlayers();
      },
    },
  },
  methods: {
    viewPlayer(steam_id) {
      this.$router.push(`/players/${steam_id}`);
    },
    async searchPlayers() {
      const response = await useFetch("/api/players-search", {
        method: "post",
        body: {
          page: this.page,
          query: this.playerQuery,
          per_page: this.per_page,
        },
      });

      const { found, request_params } = response.data.value;

      this.pagination = {
        total: found,
      };

      this.players = response.data.value.hits.map(({ document }) => {
        return document;
      });
    },
  },
};
</script>
