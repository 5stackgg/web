<script setup lang="ts">
definePageMeta({
  layout: "settings",
});
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">Application Settings</h3>
    <p class="text-sm text-muted-foreground">
      Settings that effect the application.
    </p>
  </div>
  <Separator />

  <div
    class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
    @click="toggleMatchmaking"
  >
    <div class="space-y-0.5">
      <h4 class="text-base font-medium">Matchmaking</h4>
      <p class="text-sm text-muted-foreground">
        Matchmaking allows players to join a queue and be matched with other
        players.
      </p>
    </div>
    <Switch :checked="matchMakingAllowed" @update:checked="toggleMatchmaking" />
  </div>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  data() {
    return {
      settings: [],
    };
  },
  apollo: {
    $subscribe: {
      servers: {
        query: typedGql("subscription")({
          settings: [
            {},
            {
              name: true,
              value: true,
            },
          ],
        }),
        result({ data }) {
          this.settings = data.settings;
        },
      },
    },
  },
  methods: {
    async toggleMatchmaking() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.matchmaking",
                value: this.matchMakingAllowed ? "false" : "true",
              },
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    matchMakingAllowed() {
      const matchMakingSetting = this.settings.find(
        (setting) => setting.name === "public.matchmaking",
      );

      if (matchMakingSetting) {
        return matchMakingSetting.value === "true";
      }

      return true;
    },
  },
};
</script>
