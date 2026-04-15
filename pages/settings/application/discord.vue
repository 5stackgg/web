<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card } from "~/components/ui/card";
import DiscordMatchNotificationToggles from "~/components/discord/DiscordMatchNotificationToggles.vue";
definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <form @submit.prevent="updateSettings" class="grid gap-6">
      <Card variant="gradient">
        <div class="p-6 space-y-6">
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
                $t(
                  "pages.settings.application.discord.support_role_description",
                )
              }}</FormDescription>
              <Input v-bind="componentField"></Input>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </Card>

      <Card variant="gradient">
        <div class="p-6 space-y-6">
          <div>
            <h3 class="text-lg font-medium">
              {{
                $t(
                  "pages.settings.application.discord.match_notifications.title",
                )
              }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{
                $t(
                  "pages.settings.application.discord.match_notifications.description",
                )
              }}
            </p>
          </div>

          <FormField
            v-slot="{ componentField }"
            name="discord_match_notifications_webhook"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.discord.match_notifications.webhook",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.discord.match_notifications.webhook_description",
                )
              }}</FormDescription>
              <Input v-bind="componentField"></Input>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField
            v-slot="{ componentField }"
            name="discord_match_notifications_role_id"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.discord.match_notifications.role_id",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.discord.match_notifications.role_id_description",
                )
              }}</FormDescription>
              <Input v-bind="componentField"></Input>
              <FormMessage />
            </FormItem>
          </FormField>

          <DiscordMatchNotificationToggles
            :statuses="MATCH_STATUSES"
            :values="statusToggleValues"
            :status-labels="statusLabels"
            :title="
              $t(
                'pages.settings.application.discord.match_notifications.statuses_title',
              )
            "
            :events-title="
              $t(
                'pages.settings.application.discord.match_notifications.events_title',
              )
            "
            :map-paused-key="'MapPaused'"
            @toggle="toggleStatus"
            @update="updateStatus"
          />
        </div>
      </Card>

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
import {
  e_match_status_enum,
  settings_constraint,
  settings_update_column,
} from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

const STATUS_LABEL_MAP: Record<e_match_status_enum, string> = {
  [e_match_status_enum.PickingPlayers]: "Picking Players",
  [e_match_status_enum.Scheduled]: "Scheduled",
  [e_match_status_enum.WaitingForCheckIn]: "Waiting for Check-In",
  [e_match_status_enum.WaitingForServer]: "Waiting for Server",
  [e_match_status_enum.Veto]: "Veto",
  [e_match_status_enum.Live]: "Live",
  [e_match_status_enum.Finished]: "Finished",
  [e_match_status_enum.Tie]: "Tie",
  [e_match_status_enum.Canceled]: "Canceled",
  [e_match_status_enum.Forfeit]: "Forfeit",
  [e_match_status_enum.Surrendered]: "Surrendered",
};

const MATCH_STATUSES: e_match_status_enum[] = [
  e_match_status_enum.PickingPlayers,
  e_match_status_enum.Scheduled,
  e_match_status_enum.WaitingForCheckIn,
  e_match_status_enum.WaitingForServer,
  e_match_status_enum.Veto,
  e_match_status_enum.Live,
  e_match_status_enum.Finished,
  e_match_status_enum.Tie,
  e_match_status_enum.Canceled,
  e_match_status_enum.Forfeit,
  e_match_status_enum.Surrendered,
];

export default {
  data() {
    return {
      MATCH_STATUSES,
      statusLabels: STATUS_LABEL_MAP,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            discord_invite_link: z.string().optional(),
            discord_support_webhook: z.string().optional(),
            discord_support_role_id: z.string().optional(),
            discord_match_notifications_webhook: z.string().optional(),
            discord_match_notifications_role_id: z.string().optional(),
            ...Object.fromEntries(
              Object.values(e_match_status_enum).map((s) => [
                `discord_match_notify_${s}`,
                z.string().optional(),
              ]),
            ),
            discord_match_notify_MapPaused: z.string().optional(),
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
    toggleStatus(status: string) {
      const key = `discord_match_notify_${status}`;
      this.form.setFieldValue(
        key,
        this.form.values[key] === "true" ? "false" : "true",
      );
    },
    updateStatus(status: string, enabled: boolean) {
      this.form.setFieldValue(
        `discord_match_notify_${status}`,
        enabled ? "true" : "false",
      );
    },
    async updateSettings() {
      const fields = [
        "discord_invite_link",
        "discord_support_webhook",
        "discord_support_role_id",
        "discord_match_notifications_webhook",
        "discord_match_notifications_role_id",
        ...Object.values(e_match_status_enum).map(
          (s) => `discord_match_notify_${s}`,
        ),
        "discord_match_notify_MapPaused",
      ];

      const objects = fields.map((name) => ({
        name,
        value: this.form.values[name] || "",
      }));

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects,
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
        title: this.$t("pages.settings.application.discord.updated"),
      });
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
    statusToggleValues(): Record<string, boolean> {
      return {
        ...Object.fromEntries(
          MATCH_STATUSES.map((status) => [
            status,
            this.form.values[`discord_match_notify_${status}`] === "true",
          ]),
        ),
        MapPaused: this.form.values.discord_match_notify_MapPaused === "true",
      };
    },
  },
};
</script>
