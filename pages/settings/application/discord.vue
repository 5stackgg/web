<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import DiscordMatchNotificationToggles from "~/components/discord/DiscordMatchNotificationToggles.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="defaults"
          :title="$t('pages.settings.application.discord.support_section')"
          :description="
            $t('pages.settings.application.discord.support_section_description')
          "
        >
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

          <FormField v-slot="{ componentField }" name="discord_invite_link">
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.discord.invite_link")
              }}</FormLabel>
              <Input v-bind="componentField"></Input>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="match-notifications"
          :title="
            $t('pages.settings.application.discord.match_notifications.title')
          "
          :description="
            $t(
              'pages.settings.application.discord.match_notifications.description',
            )
          "
        >
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
              <Input
                v-bind="componentField"
                :placeholder="form.values.discord_support_webhook || ''"
              />
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
              <Input
                v-bind="componentField"
                :placeholder="form.values.discord_support_role_id || ''"
              />
              <FormMessage />
            </FormItem>
          </FormField>

          <DiscordMatchNotificationToggles
            :statuses="TOGGLE_KEYS"
            :values="statusToggleValues"
            :status-labels="statusLabels"
            @toggle="toggleStatus"
            @update="updateStatus"
          />
        </SettingsSection>

        <SettingsSection
          id="gamedata-notifications"
          :title="
            $t('pages.settings.application.discord.gamedata_notifications.title')
          "
          :description="
            $t(
              'pages.settings.application.discord.gamedata_notifications.description',
            )
          "
        >
          <FormField
            v-slot="{ componentField }"
            name="discord_gamedata_notifications_webhook"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.discord.gamedata_notifications.webhook",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.discord.gamedata_notifications.webhook_description",
                )
              }}</FormDescription>
              <Input
                v-bind="componentField"
                :placeholder="form.values.discord_support_webhook || ''"
              />
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField
            v-slot="{ componentField }"
            name="discord_gamedata_notifications_role_id"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.discord.gamedata_notifications.role_id",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.discord.gamedata_notifications.role_id_description",
                )
              }}</FormDescription>
              <Input
                v-bind="componentField"
                :placeholder="form.values.discord_support_role_id || ''"
              />
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="server-notifications"
          :title="
            $t('pages.settings.application.discord.server_notifications.title')
          "
          :description="
            $t(
              'pages.settings.application.discord.server_notifications.description',
            )
          "
        >
          <FormField v-slot="{ componentField }" name="disk_warning_percent">
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.discord.server_notifications.disk_warning_percent",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.discord.server_notifications.disk_warning_percent_description",
                )
              }}</FormDescription>
              <Input type="number" v-bind="componentField" min="0" max="100" />
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="disk_critical_percent">
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.discord.server_notifications.disk_critical_percent",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.discord.server_notifications.disk_critical_percent_description",
                )
              }}</FormDescription>
              <Input type="number" v-bind="componentField" min="0" max="100" />
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <div class="flex justify-start">
          <Button
            type="submit"
            :loading="submitting"
            :disabled="Object.keys(form.errors).length > 0 || !form.meta.dirty"
            class="my-3"
          >
            {{ $t("common.update") }}
          </Button>
        </div>
      </form>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import {
  e_match_status_enum,
  settings_constraint,
  settings_update_column,
} from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

const STATUS_LABEL_MAP: Record<string, string> = {
  [e_match_status_enum.WaitingForServer]: "Waiting for Server",
  MapPaused: "Map Paused",
};

const MATCH_STATUSES: e_match_status_enum[] = [
  e_match_status_enum.WaitingForServer,
];

const TOGGLE_KEYS: string[] = [...MATCH_STATUSES, "MapPaused"];

export default {
  data() {
    return {
      submitting: false,
      MATCH_STATUSES,
      TOGGLE_KEYS,
      statusLabels: STATUS_LABEL_MAP,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            discord_invite_link: z.string().optional(),
            discord_support_webhook: z.string().optional(),
            discord_support_role_id: z.string().optional(),
            discord_match_notifications_webhook: z.string().optional(),
            discord_match_notifications_role_id: z.string().optional(),
            discord_gamedata_notifications_webhook: z.string().optional(),
            discord_gamedata_notifications_role_id: z.string().optional(),
            ...Object.fromEntries(
              MATCH_STATUSES.map((s) => [
                `discord_match_notify_${s}`,
                z.string().optional(),
              ]),
            ),
            discord_match_notify_MapPaused: z.string().optional(),
            disk_warning_percent: z.number().min(0).max(100).default(75),
            disk_critical_percent: z.number().min(0).max(100).default(90),
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
          if (
            setting.name === "disk_warning_percent" ||
            setting.name === "disk_critical_percent"
          ) {
            this.form.setFieldValue(setting.name, parseInt(setting.value));
          } else {
            this.form.setFieldValue(setting.name, setting.value || "");
          }
        }
        this.form.resetForm({ values: this.form.values });
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
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        const fields = [
          "discord_invite_link",
          "discord_support_webhook",
          "discord_support_role_id",
          "discord_match_notifications_webhook",
          "discord_match_notifications_role_id",
          "discord_gamedata_notifications_webhook",
          "discord_gamedata_notifications_role_id",
          ...MATCH_STATUSES.map((s) => `discord_match_notify_${s}`),
          "discord_match_notify_MapPaused",
          "disk_warning_percent",
          "disk_critical_percent",
        ];

        const objects = fields.map((name) => ({
          name,
          value:
            this.form.values[name] != null
              ? String(this.form.values[name])
              : "",
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
      } finally {
        this.submitting = false;
      }
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
