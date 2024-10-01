<script lang="ts" setup>
import { AlertTriangle } from "lucide-vue-next";
import MatchMakingRegion from "./MatchMakingRegion.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <div v-if="matchMakingAllowed">
    <template v-if="me.matchmaking_cooldown">
      <Alert class="my-3">
        <AlertTitle>Matchmaking Cooldown</AlertTitle>

        <AlertDescription class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4" />
          You are temporarily banned from matchmaking, you will be able to join
          <TimeAgo :date="me.matchmaking_cooldown" />
        </AlertDescription>
      </Alert>
    </template>
    <template v-else-if="!confirmationDetails">
      <MatchMakingRegion
        :region="region"
        v-for="region in regions"
      ></MatchMakingRegion>
    </template>
    <template v-else-if="match">
      <div class="flex justify-between items-center">
        <div>
          <Badge variant="secondary" class="text-lg">
            {{ match.status }}
          </Badge>

          <QuickServerConnect :match="match" />
        </div>

        <Button>
          <NuxtLink :to="`/matches/${match.id}`" class="text-xl font-bold">
            Go to Match
          </NuxtLink>
        </Button>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  apollo: {
    $subscribe: {
      e_server_regions: {
        query: typedGql("subscription")({
          e_server_regions: [
            {
              where: {
                total_server_count: {
                  _gt: 0,
                },
              },
            },
            {
              value: true,
              description: true,
            },
          ],
        }),
        result({ data }) {
          this.regions = data.e_server_regions;
        },
      },
      matches_by_pk: {
        variables: function () {
          return {
            matchId: this.confirmationDetails?.matchId,
          };
        },
        query: typedGql("subscription")({
          matches_by_pk: [
            {
              id: $("matchId", "uuid!"),
            },
            {
              id: true,
              status: true,
              region: true,
              server_type: true,
              is_server_online: true,
              connection_string: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.match = data.matches_by_pk;
        },
      },
    },
  },
  data() {
    return {
      match: undefined,
      regions: undefined,
    };
  },
  computed: {
    confirmationDetails() {
      return useMatchMakingStore().joinedMatchmakingQueues.confirmation;
    },
    matchMakingAllowed() {
      return useApplicationSettingsStore().matchMakingAllowed;
    },
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
