<script lang="ts" setup>
import SimpleMatchDisplay from "./SimpleMatchDisplay.vue";
</script>

<template>
  <div class="flex gap-4">
    <SimpleMatchDisplay
      :key="match.id"
      :match="match"
      v-for="match of matches"
    ></SimpleMatchDisplay>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { $, e_match_status_enum, order_by } from "~/generated/zeus";
import SimpleMatchDisplay from "./SimpleMatchDisplay.vue";

export default {
  apollo: {
    matches: {
      fetchPolicy: "network-only",
      query: generateQuery({
        matches: [
          {
            where: {
              is_in_lineup: {
                _eq: true,
              },
              status: {
                _in: $("statuses", "[e_match_status_enum]"),
              },
            },
            order_by: [
              {},
              {
                created_at: order_by.desc,
              },
            ],
          },
          simpleMatchFields,
        ],
      }),
      variables: function () {
        return {
          statuses: [
            e_match_status_enum.Live,
            e_match_status_enum.Veto,
            e_match_status_enum.Scheduled,
            e_match_status_enum.WaitingForCheckIn,
          ],
        };
      },
    },
  },
};
</script>
