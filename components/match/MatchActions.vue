<template>
  <Button size="sm" variant="outline" class="h-8 gap-1" v-if="match.server">
    <Copy class="h-3.5 w-3.5" />
    <span class="lg:sr-only xl:not-sr-only xl:whitespace-nowrap">
      Copy Server Connection
    </span>
  </Button>

  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button size="icon" variant="outline" class="h-8 w-8">
        <MoreVertical class="h-3.5 w-3.5" />
        <span class="sr-only">More</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem>Edit</DropdownMenuItem>
      <DropdownMenuItem>Export</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Cancel Match</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

<!--  <template v-if="match.status == e_match_status_enum.PickingPlayers">-->
<!--    <Form @submit.prevent v-if="!canAddToLineup1 && !canAddToLineup2">-->
<!--      <five-stack-select-input-->
<!--        label="Server"-->
<!--        :options="availableServers"-->
<!--        v-model="form.server_id"-->
<!--      ></five-stack-select-input>-->
<!--      <Button @click="scheduleMatch">-->
<!--        Schedule Match!-->
<!--      </Button>-->
<!--    </Form>-->
<!--  </template>-->
<!--  <template v-if="match.status == e_match_status_enum.Scheduled">-->
<!--    <form @submit.prevent="startMatch">-->
<!--      <div v-if="match.server_id && !match.is_match_server_available">-->
<!--        <p>-->
<!--          Another match is on going on the selected server. Once complete match-->
<!--          will be able to be started.-->
<!--        </p>-->

<!--        <p class="mt-4">Choose another server.</p>-->
<!--      </div>-->

<!--      <five-stack-select-input-->
<!--        v-if="!match.server_id || !match.is_match_server_available"-->
<!--        label="Server"-->
<!--        :options="availableServers"-->
<!--        v-model="form.server_id"-->
<!--      ></five-stack-select-input>-->

<!--      <five-stack-button> Start Match </five-stack-button>-->
<!--    </form>-->
<!--  </template>-->
<!--  <template-->
<!--    v-else-if="-->
<!--      match.status != e_match_status_enum.Canceled &&-->
<!--      match.status != e_match_status_enum.Finished-->
<!--    "-->
<!--  >-->
<!--    <div class="underline flex" v-if="match.connection_string">-->
<!--      <clip-board :data="match.connection_string"></clip-board>-->
<!--      <a :href="`https://5stack.gg${match.connection_link}`">-->
<!--        {{ match.connection_string }}-->
<!--      </a>-->
<!--    </div>-->
<!--    <div v-else-if="!match.server_id" class="underline">-->
<!--      Server has not been assigned-->
<!--    </div>-->
<!--    <div v-else>-->
<!--      <clip-board :data="match.tv_connection_string"></clip-board>-->
<!--      <a :href="`https://5stack.gg${match.tv_connection_link}`">-->
<!--        {{ match.tv_connection_string }}-->
<!--      </a>-->
<!--    </div>-->

<!--    <Button size="sm" variant="destructive" @click="cancelMatch" > Cancel Match </Button>-->
<!--  </template>-->
</template>

<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "~/components/ui/dropdown-menu";
import {Copy, MoreVertical} from "lucide-vue-next";
import {Button} from "~/components/ui/button";
</script>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import getMatchLineups from "~/utilities/getMatchLineups";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
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
        // .filter((server) => {
        //   return this.match.server_id !== server.id;
        // })
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
