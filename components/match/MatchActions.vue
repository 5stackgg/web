<template>
  <template v-if="match.status == e_match_status_enum.PickingPlayers">
    <form @submit.prevent v-if="!canAddToLineup1 && !canAddToLineup2">
      <five-stack-select-input
        label="Server"
        :options="availableServers"
        v-model="form.server_id"
      ></five-stack-select-input>
      <five-stack-button @click="scheduleMatch">
        Schedule Match!
      </five-stack-button>
    </form>
  </template>
  <template v-if="match.status == e_match_status_enum.Scheduled">
    <div v-if="match.server_id && !match.is_match_server_available">
      <p>
        Another match is on going on the selected server. Once complete match
        will be able to be started.
      </p>

      <p class="mt-4">Choose another server.</p>
    </div>

    <form @submit.prevent="startMatch">
      <five-stack-select-input
        label="Server"
        :options="availableServers"
        v-model="form.server_id"
      ></five-stack-select-input>
      <five-stack-button> Start Match </five-stack-button>
    </form>
  </template>
  <template
    v-else-if="
      match.status != e_match_status_enum.Canceled &&
      match.status != e_match_status_enum.Finished
    "
  >
    <div class="text-purple-400 underline flex" v-if="match.connection_string">
      <clip-board :data="match.connection_string"></clip-board>
      <a :href="`https://api.5stack.gg${match.connection_link}`">
        {{ match.connection_string }}
      </a>
    </div>
    <div v-else-if="!match.server_id" class="text-red-400 underline">
      Server has not been assigned
    </div>
    <div v-else>
      <clip-board :data="match.tv_connection_string"></clip-board>
      <a :href="`https://api.5stack.gg${match.tv_connection_link}`">
        {{ match.tv_connection_string }}
      </a>
    </div>

    <five-stack-button @click="cancelMatch"> Cancel Match </five-stack-button>
  </template>
</template>

<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
</script>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import getMatchLineups from "~/utilities/getMatchLineups";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";

export default {
  components: {
    FiveStackSelectInput,
  },
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      servers: [],
      form: {
        server_id: undefined,
      },
    };
  },
  apollo: {
    $subscribe: {
      servers: {
        query: typedGql("subscription")({
          servers: [
            {},
            {
              id: true,
              host: true,
              port: true,
              label: true,
            },
          ],
        }),
        result({ data }) {
          this.servers = data.servers;
        },
      },
    },
  },
  methods: {
    async scheduleMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          scheduleMatch: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
    async startMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          startMatch: [
            {
              match_id: this.match.id,
              server_id: this.form.server_id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
    async cancelMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          cancelMatch: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    matchLineups() {
      return getMatchLineups(this.match);
    },
    maxPlayersPerLineup() {
      return this.match?.type === "Wingman" ? 2 : 5;
    },
    canAddToLineup1() {
      return (
        this.matchLineups.lineup1?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
    canAddToLineup2() {
      return (
        this.matchLineups.lineup2?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
    availableServers() {
      const servers = this.servers
        .filter((server) => {
          return this.match.server_id !== server.id;
        })
        .map((server) => {
          return {
            value: server.id,
            display: `${server.label} (${server.host}:${server.port})`,
          };
        });

      servers.unshift({
        value: null,
        display: "On Demand",
      });

      return servers;
    },
  },
};
</script>
