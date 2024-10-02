<script lang="ts" setup>
import SimpleMatchDisplay from "~/components/SimpleMatchDisplay.vue";
</script>
<template>
  <div class="flex gap-4 overflow-x-auto">
    <SimpleMatchDisplay
      :match="match"
      v-for="match of matches"
      :key="match.id"
      class="flex-shrink-0"
      v-if="matches?.length > 0"
    ></SimpleMatchDisplay>
    <template v-else>
      <div class="text-center w-full p-4">
        <p class="text-muted-foreground">You don't have any recent matches.</p>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import {
  $,
  e_lobby_access_enum,
  e_match_status_enum,
  order_by,
} from "~/generated/zeus";

export default {
  data() {
    return {
      matches: [],
    };
  },
  apollo: {
    $subscribe: {
      matches: {
        variables: function () {
          return {
            order_by: order_by.asc,
            matchId: this.$route.params.id,
          };
        },
        query: typedGql("subscription")({
          matches: [
            {
              limit: $("limit", "Int!"),
              where: {
                is_in_lineup: {
                  _eq: true,
                },
                status: {
                  _nin: $("statuses", "[e_match_status_enum]"),
                },
              },
              order_by: [
                {},
                {
                  created_at: $("order_by", "order_by"),
                },
              ],
            },
            simpleMatchFields,
          ],
        }),
        variables: function () {
          return {
            limit: 10,
            statuses: [
              e_match_status_enum.Live,
              e_match_status_enum.Veto,
              e_match_status_enum.Scheduled,
              e_match_status_enum.PickingPlayers,
              e_match_status_enum.WaitingForCheckIn,
            ],
          };
        },
        result: function ({ data }) {
          this.matches = data.matches;
        },
      },
    },
  },
};
</script>
