<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <form @submit.prevent="updateSettings" class="grid gap-6">
      <FormField v-slot="{ componentField }" name="discord_invite_link">
        <FormItem>
          <FormLabel>{{
            $t("pages.settings.application.discord.invite_link")
          }}</FormLabel>
          <Input v-bind="componentField"></Input>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="discord_support_webhook">
        <FormItem>
          <FormLabel>{{
            $t("pages.settings.application.discord.webhook")
          }}</FormLabel>
          <FormDescription>{{
            $t("pages.settings.application.discord.webhook_description")
          }}</FormDescription>
          <Input v-bind="componentField"></Input>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="discord_support_role_id">
        <FormItem>
          <FormLabel>{{
            $t("pages.settings.application.discord.support_role")
          }}</FormLabel>
          <FormDescription>{{
            $t("pages.settings.application.discord.support_role_description")
          }}</FormDescription>
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
          {{ $t("pages.settings.application.discord.update") }}
        </Button>
      </div>
    </form>
  </PageTransition>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
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
  watch: {
    settings: {
      immediate: true,
      handler(newVal) {
        for (const setting of newVal) {
          this.form.setFieldValue(setting.name, setting.value || "");
        }
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
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
  },
};
</script>
