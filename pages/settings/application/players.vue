<script setup lang="ts">
definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <form class="grid gap-4">
    <div
      class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
      @click="togglePlayerNameRegistration"
    >
      <div class="space-y-0.5">
        <h4 class="text-base font-medium">
          {{ $t("pages.settings.application.players.force_name_registration") }}
        </h4>
        <p class="text-sm text-muted-foreground">
          {{
            $t(
              "pages.settings.application.players.force_name_registration_description",
            )
          }}
        </p>
      </div>
      <Switch
        :checked="playerNameRegistration"
        @update:checked="togglePlayerNameRegistration"
      />
    </div>
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
            public: z.object({
              player_name_registration: z.string().default("false"),
            }),
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
            this.form.setFieldValue(setting.name, setting.value || "");
          }
        },
      },
    },
  },
  methods: {
    async togglePlayerNameRegistration() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.player_name_registration",
                value: this.playerNameRegistration ? "false" : "true",
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
    playerNameRegistration() {
      const playerNameRegistrationSetting = this.settings.find(
        (setting) => setting.name === "public.player_name_registration",
      );

      if (playerNameRegistrationSetting) {
        return playerNameRegistrationSetting.value === "true";
      }

      return false;
    },
  },
};
</script>
