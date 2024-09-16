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

  <form @submit.prevent="updateSettings">
    <FormField v-slot="{ componentField }" name="discord_support_webhook">
      <FormItem>
        <FormLabel>Discord Webhook</FormLabel>
        <FormDescription
          >We use this discord webhook to send notifications that require action
          from a player. Ex. match issues, bugs, etc.</FormDescription
        >
        <Input v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button
      type="submit"
      :disabled="Object.keys(form.errors).length > 0"
      class="my-3"
    >
      Update
    </Button>
  </form>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

export default {
  data() {
    return {
      settings: [],
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            discord_support_webhook: z.string().optional(),
          }),
        ),
      }),
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
          for (const setting of data.settings) {
            this.form.setFieldValue(setting.name, setting.value);
          }
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
    async updateSettings() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "discord_support_webhook",
                  value: this.form.values.discord_support_webhook,
                },
              ],
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
