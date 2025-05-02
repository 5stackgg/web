<script lang="ts" setup>
import { AlertTriangle } from "lucide-vue-next";
import MatchmakingRegion from "./MatchmakingRegion.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
</script>

<template>
  <div v-if="matchmakingAllowed">
    <template v-if="me.is_banned">
      <Alert class="my-3">
        <AlertDescription class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4" />
          {{ $t("matchmaking.banned") }}
        </AlertDescription>
      </Alert>
    </template>
    <template v-else-if="me.matchmaking_cooldown">
      <Alert class="my-3">
        <AlertDescription class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4" />
          {{
            $t("matchmaking.temp_banned", {
              time: me.matchmaking_cooldown,
            })
          }}
        </AlertDescription>
      </Alert>
    </template>
    <div v-else-if="!confirmationDetails" class="flex flex-col gap-4">
      <MatchmakingRegion
        :region="region"
        v-for="region in regions"
      ></MatchmakingRegion>
    </div>
    <template v-else-if="match">
      <div class="flex justify-between items-center">
        <div>
          <Badge variant="secondary" class="text-lg">
            {{ match.status }}
          </Badge>

          <QuickServerConnect :match="match" />
        </div>

        <Button>
          <NuxtLink
            :to="{ name: 'matches', params: { id: match.id } }"
            class="text-xl font-bold bg-foreground"
          >
            {{ $t("matchmaking.go_to_match") }}
          </NuxtLink>
        </Button>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

export default {
  apollo: {
    $subscribe: {
      matches_by_pk: {
        variables: function () {
          return {
            matchId: this.confirmationDetails?.matchId,
          };
        },
        skip() {
          return !this.confirmationDetails?.matchId;
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
      playerSanctions: [],
    };
  },
  computed: {
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
    confirmationDetails() {
      return useMatchmakingStore().joinedMatchmakingQueues.confirmation;
    },
    matchmakingAllowed() {
      return useApplicationSettingsStore().matchmakingAllowed;
    },
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
