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
        <FormLabel>Discord Invite Link</FormLabel>
        <Input v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>

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

    <FormField v-slot="{ componentField }" name="discord_support_role_id">
      <FormItem>
        <FormLabel>Discord Support Role ID</FormLabel>
        <FormDescription
          >Thie role will be pinged when used for support actions. You can get
          the Role ID from the Discord application by turning on devleoper mode
          and right clicking and copy id.</FormDescription
        >
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
        Update
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
