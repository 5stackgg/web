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
    :per-page="10"
    :offset="playersOffset"
    @offset="
      (offset) => {
        playersOffset = offset;
      }
    "
    :total="players_aggregate.aggregate.count"
    v-if="players_aggregate"
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
      playersOffset: 0,
      playerQuery: null,
    };
  },
  apollo: {
    players: {
      fetchPolicy: "network-only",
      query: function () {
        // TODO - use typesense instead?
        return generateQuery({
          players: [
            {
              limit: 10,
              offset: $("offset", "Int!"),
              ...(this.playerQuery?.length >= 3 && {
                where: {
                  ...(/^[0-9]+$/.test(this.playerQuery)
                    ? {
                        steam_id: {
                          _eq: $("playerSteamIdQuery", "bigint"),
                        },
                      }
                    : {
                        name: {
                          _ilike: $("playerQuery", "String"),
                        },
                      }),
                },
              }),
            },
            {
              name: true,
              steam_id: true,
            },
          ],
        });
      },
      variables: function () {
        return {
          offset: this.playersOffset,
          playerQuery: `%${this.playerQuery}%`,
          playerSteamIdQuery: this.playerQuery,
        };
      },
    },
    players_aggregate: {
      fetchPolicy: "network-only",
      query: function () {
        return generateQuery({
          players_aggregate: [
            {
              ...(this.playerQuery?.length >= 3 && {
                where: {
                  ...(/^[0-9]+$/.test(this.playerQuery)
                    ? {
                        steam_id: {
                          _eq: $("playerSteamIdQuery", "bigint"),
                        },
                      }
                    : {
                        name: {
                          _ilike: $("playerQuery", "String"),
                        },
                      }),
                },
              }),
            },
            {
              aggregate: {
                count: true,
              },
            },
          ],
        });
      },
      variables: function () {
        return {
          playerQuery: `%${this.playerQuery}%`,
          playerSteamIdQuery: this.playerQuery,
        };
      },
    },
  },
  methods: {
    viewPlayer(steam_id) {
      this.$router.push(`/players/${steam_id}`);
    },
  },
};
</script>
