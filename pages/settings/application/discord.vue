<script setup lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <form @submit.prevent="updateSettings" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="discord_invite_link">
      <FormItem>
        <FormLabel>{{ $t('pages.settings.application.discord.invite_link') }}</FormLabel>
        <Input v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="discord_support_webhook">
      <FormItem>
        <FormLabel>{{ $t('pages.settings.application.discord.webhook') }}</FormLabel>
        <FormDescription>{{ $t('pages.settings.application.discord.webhook_description') }}</FormDescription>
        <Input v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="discord_support_role_id">
      <FormItem>
        <FormLabel>{{ $t('pages.settings.application.discord.support_role') }}</FormLabel>
        <FormDescription>{{ $t('pages.settings.application.discord.support_role_description') }}</FormDescription>
        <Input v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="flex justify-start">
      <Button
        type="submit"
        :disabled="Object.keys(form.errors).length > 0"
        class="my-3"
      >
        {{ $t('pages.settings.application.discord.update') }}
      </Button>
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
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      settings: [],
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            discord_invite_link: z.string().optional(),
            discord_support_webhook: z.string().optional(),
            discord_support_role_id: z.string().optional(),
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
    async updateSettings() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "discord_invite_link",
                  value: this.form.values.discord_invite_link,
                },
                {
                  name: "discord_support_webhook",
                  value: this.form.values.discord_support_webhook,
                },
                {
                  name: "discord_support_role_id",
                  value: this.form.values.discord_support_role_id,
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

      toast({
        title: "Updated Discord Settings",
      });
    },
  },
};
</script>
