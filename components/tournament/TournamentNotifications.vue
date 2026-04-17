<template>
  <div v-if="canManageNotifications" class="grid gap-6">
    <Card variant="gradient">
      <div class="p-6 space-y-6">
        <div
          class="flex items-center justify-between cursor-pointer select-none"
          role="button"
          tabindex="0"
          @click="toggleMaster"
          @keydown.enter.prevent="toggleMaster"
          @keydown.space.prevent="toggleMaster"
        >
          <div class="space-y-0.5">
            <span class="text-sm font-medium">{{
              $t("tournament.form.discord_notifications")
            }}</span>
            <p class="text-xs text-muted-foreground">
              {{ $t("tournament.form.discord_notifications_description") }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Switch
              @click.stop
              :model-value="form.discord_notifications_enabled === true"
              @update:model-value="updateMaster($event)"
            />
          </div>
        </div>
      </div>
    </Card>

    <Card v-if="isNotificationsEnabled" variant="gradient">
      <div class="p-6 space-y-6">
        <div>
          <h4 class="text-base font-medium">
            {{ $t("tournament.voice.title") }}
          </h4>
          <p class="text-sm text-muted-foreground">
            {{ $t("tournament.voice.description") }}
          </p>
        </div>

        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <Input
              :model-value="form.discord_guild_id ?? ''"
              :placeholder="$t('tournament.voice.guild_id_placeholder')"
              inputmode="numeric"
              pattern="[0-9]*"
              @update:model-value="
                form.discord_guild_id = $event.replace(/[^0-9]/g, '') || null;
                dirty = true;
              "
            />
          </div>
        </div>

        <div
          class="flex items-center justify-between rounded-lg border p-3 cursor-pointer select-none"
          role="button"
          tabindex="0"
          @click="
            form.discord_voice_enabled = !form.discord_voice_enabled;
            dirty = true;
          "
          @keydown.enter.prevent="
            form.discord_voice_enabled = !form.discord_voice_enabled;
            dirty = true;
          "
          @keydown.space.prevent="
            form.discord_voice_enabled = !form.discord_voice_enabled;
            dirty = true;
          "
        >
          <span class="text-sm font-medium">{{
            $t("tournament.voice.enable_voice")
          }}</span>
          <Switch
            @click.stop
            :model-value="form.discord_voice_enabled"
            @update:model-value="
              form.discord_voice_enabled = $event;
              dirty = true;
            "
          />
        </div>
      </div>
    </Card>

    <Card v-if="isNotificationsEnabled" variant="gradient">
      <div class="p-6 space-y-6">
        <div>
          <h4 class="text-base font-medium">
            {{ $t("tournament.notifications.webhook") }}
          </h4>
        </div>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <Input
              :model-value="form.discord_webhook ?? ''"
              :placeholder="
                effectiveWebhookDefault ||
                $t('tournament.notifications.webhook_placeholder')
              "
              @update:model-value="updateWebhook($event)"
            />
          </div>
        </div>

        <div>
          <h4 class="text-base font-medium">
            {{ $t("tournament.notifications.role_id") }}
          </h4>
          <p class="text-sm text-muted-foreground">
            {{ $t("tournament.notifications.role_id_description") }}
          </p>
        </div>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <Input
              :model-value="form.discord_role_id ?? ''"
              :placeholder="
                globalRoleId ||
                $t('tournament.notifications.role_id_placeholder')
              "
              @update:model-value="updateRoleId($event)"
            />
          </div>
        </div>
      </div>
    </Card>

    <Card v-if="isNotificationsEnabled" variant="gradient">
      <div class="p-6 space-y-6">
        <DiscordMatchNotificationToggles
          :statuses="MATCH_STATUSES"
          :values="statusToggleValues"
          :default-values="statusDefaultValues"
          :status-labels="statusLabels"
          :title="$t('tournament.notifications.statuses_title')"
          :events-title="$t('tournament.notifications.events_title')"
          :map-paused-key="'MapPaused'"
          @toggle="toggleStatus"
          @update="updateStatusValue"
        />
      </div>
    </Card>

    <div class="flex justify-start">
      <Button @click="save" :disabled="saving" class="my-3">
        {{ $t("tournament.notifications.save") }}
      </Button>
    </div>
  </div>
</template>

<script lang="ts">
import { Card } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Button } from "@/components/ui/button";
import DiscordMatchNotificationToggles from "~/components/discord/DiscordMatchNotificationToggles.vue";
import { $, e_match_status_enum, e_player_roles_enum } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

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

const STATUS_FIELDS = [
  "discord_notify_PickingPlayers",
  "discord_notify_Scheduled",
  "discord_notify_WaitingForCheckIn",
  "discord_notify_WaitingForServer",
  "discord_notify_Veto",
  "discord_notify_Live",
  "discord_notify_Finished",
  "discord_notify_Tie",
  "discord_notify_Canceled",
  "discord_notify_Forfeit",
  "discord_notify_Surrendered",
  "discord_notify_MapPaused",
] as const;

const OTHER_DISCORD_FIELDS = [
  "discord_notifications_enabled",
  "discord_webhook",
  "discord_role_id",
  "discord_guild_id",
  "discord_voice_enabled",
] as const;

const DISCORD_FIELDS = [...OTHER_DISCORD_FIELDS, ...STATUS_FIELDS] as const;

export default {
  components: {
    DiscordMatchNotificationToggles,
  },
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      MATCH_STATUSES,
      form: this.buildForm({}),
      discordData: null as Record<string, any> | null,
      saving: false,
      dirty: false,
      statusOverrideDirty: false,
    };
  },
  apollo: {
    $subscribe: {
      tournaments_by_pk: {
        query: typedGql("subscription")({
          tournaments_by_pk: [
            {
              id: $("tournamentId", "uuid!"),
            },
            {
              id: true,
              discord_guild_id: true,
              discord_notifications_enabled: true,
              discord_voice_enabled: true,
              discord_webhook: true,
              discord_role_id: true,
              discord_notify_PickingPlayers: true,
              discord_notify_Scheduled: true,
              discord_notify_WaitingForCheckIn: true,
              discord_notify_WaitingForServer: true,
              discord_notify_Veto: true,
              discord_notify_Live: true,
              discord_notify_Finished: true,
              discord_notify_Tie: true,
              discord_notify_Canceled: true,
              discord_notify_Forfeit: true,
              discord_notify_Surrendered: true,
              discord_notify_MapPaused: true,
            },
          ],
        }),
        variables(this: any) {
          return {
            tournamentId: this.tournament.id,
          };
        },
        result(
          this: any,
          { data }: { data: { tournaments_by_pk: Record<string, any> } },
        ) {
          this.discordData = data.tournaments_by_pk;
          if (!this.dirty) {
            this.form = this.buildForm(this.discordData ?? {});
          }
        },
      },
    },
  },
  computed: {
    canManageNotifications(): boolean {
      return (
        useAuthStore().isAdmin ||
        useAuthStore().isRoleAbove(e_player_roles_enum.tournament_organizer)
      );
    },
    isNotificationsEnabled(): boolean {
      return this.form.discord_notifications_enabled === true;
    },
    settings() {
      return useApplicationSettingsStore().settings;
    },
    settingMap(): Record<string, string> {
      return Object.fromEntries(
        this.settings.map((s: { name: string; value?: string }) => [
          s.name,
          s.value || "",
        ]),
      );
    },
    resolveSettingValue(): (names: string[]) => string | null {
      return (names: string[]) => {
        for (const name of names) {
          if (this.settingMap[name]) {
            return this.settingMap[name];
          }
          const publicName = `public.${name}`;
          if (this.settingMap[publicName]) {
            return this.settingMap[publicName];
          }
        }
        return null;
      };
    },
    globalMatchNotificationsWebhook(): string | null {
      return this.resolveSettingValue(["discord_match_notifications_webhook"]);
    },
    globalDiscordWebhook(): string | null {
      return this.resolveSettingValue([
        "discord_support_webhook",
        "discord_webhook",
      ]);
    },
    effectiveWebhookDefault(): string | null {
      // Fallback order:
      // 1) Match Notifications Webhook URL
      // 2) Discord Webhook
      return this.globalMatchNotificationsWebhook || this.globalDiscordWebhook;
    },
    globalRoleId(): string | null {
      return this.resolveSettingValue([
        "discord_match_notifications_role_id",
        "discord_support_role_id",
        "discord_role_id",
      ]);
    },
    globalStatusDefaults(): Record<string, boolean> {
      const defaults: Record<string, boolean> = {};
      for (const status of MATCH_STATUSES) {
        const setting = this.settings.find(
          (s: { name: string; value?: string }) =>
            s.name === `discord_match_notify_${status}`,
        );
        defaults[`discord_notify_${status}`] = setting?.value === "true";
      }

      const mapPausedSetting = this.settings.find(
        (s: { name: string; value?: string }) =>
          s.name === "discord_match_notify_MapPaused",
      );
      defaults.discord_notify_MapPaused = mapPausedSetting?.value === "true";
      return defaults;
    },
    hasGlobalStatusNotificationsEnabled(): boolean {
      return Object.values(this.globalStatusDefaults).some(Boolean);
    },
    statusLabels(): Record<string, string> {
      return {
        ...Object.fromEntries(
          MATCH_STATUSES.map((status) => [
            status,
            this.$t(`tournament.notifications.status.${status}`),
          ]),
        ),
        MapPaused: this.$t("tournament.notifications.map_paused"),
      };
    },
    statusToggleValues(): Record<string, boolean> {
      return {
        ...Object.fromEntries(
          MATCH_STATUSES.map((status) => [
            status,
            this.form[`discord_notify_${status}`] === true,
          ]),
        ),
        MapPaused: this.form.discord_notify_MapPaused === true,
      };
    },
    statusDefaultValues(): Record<string, boolean> {
      const defaults = this.globalStatusDefaults;
      return {
        ...Object.fromEntries(
          MATCH_STATUSES.map((status) => [
            status,
            defaults[`discord_notify_${status}`] === true,
          ]),
        ),
        MapPaused: defaults.discord_notify_MapPaused === true,
      };
    },
    hasPersistedStatusOverrides(): boolean {
      const t = this.discordData;
      if (!t) {
        return false;
      }
      return STATUS_FIELDS.some(
        (field) => t[field] !== null && t[field] !== undefined,
      );
    },
  },
  methods: {
    buildForm(tournament: Record<string, any>) {
      const form: Record<string, any> = {};
      const statusDefaults = this.globalStatusDefaults || {};
      const BOOLEAN_FIELDS = new Set<string>([
        "discord_notifications_enabled",
        "discord_voice_enabled",
        "discord_notify_PickingPlayers",
        "discord_notify_Scheduled",
        "discord_notify_WaitingForCheckIn",
        "discord_notify_WaitingForServer",
        "discord_notify_Veto",
        "discord_notify_Live",
        "discord_notify_Finished",
        "discord_notify_Tie",
        "discord_notify_Canceled",
        "discord_notify_Forfeit",
        "discord_notify_Surrendered",
        "discord_notify_MapPaused",
      ]);
      for (const field of DISCORD_FIELDS) {
        if (BOOLEAN_FIELDS.has(field)) {
          if (field === "discord_notifications_enabled") {
            form[field] =
              tournament[field] ?? this.hasGlobalStatusNotificationsEnabled;
            continue;
          }
          if (
            field.startsWith("discord_notify_") &&
            typeof statusDefaults[field] === "boolean"
          ) {
            form[field] = tournament[field] ?? statusDefaults[field];
          } else {
            form[field] = tournament[field] ?? false;
          }
        } else {
          form[field] = tournament[field] ?? null;
        }
      }
      return form;
    },
    toggleMaster() {
      this.form.discord_notifications_enabled =
        !this.form.discord_notifications_enabled;
      this.dirty = true;
    },
    updateMaster(val: boolean) {
      this.form.discord_notifications_enabled = val;
      this.dirty = true;
    },
    toggleStatus(status: string) {
      const key = `discord_notify_${status}`;
      this.form[key] = !this.form[key];
      this.dirty = true;
      this.statusOverrideDirty = true;
    },
    updateStatusValue(status: string, val: boolean) {
      const key = `discord_notify_${status}`;
      this.form[key] = val;
      this.dirty = true;
      this.statusOverrideDirty = true;
    },
    updateWebhook(value: string) {
      const v = value || null;
      this.form.discord_webhook = v;
      this.dirty = true;
    },
    updateRoleId(value: string) {
      const v = value || null;
      this.form.discord_role_id = v;
      this.dirty = true;
    },
    async save() {
      const variables: Record<string, any> = {};
      const _set: Record<string, any> = {};

      const includeStatusFields =
        this.statusOverrideDirty || this.hasPersistedStatusOverrides;
      const fieldsToSave = includeStatusFields
        ? DISCORD_FIELDS
        : OTHER_DISCORD_FIELDS;

      for (const field of fieldsToSave) {
        let value = this.form[field];
        if (field === "discord_webhook") {
          value = value === "" ? null : value;
          value = value ?? this.effectiveWebhookDefault ?? null;
        } else if (field === "discord_role_id") {
          value = value === "" ? null : value;
          value = value ?? this.globalRoleId ?? null;
        } else if (field === "discord_guild_id") {
          value = value === "" ? null : value;
        }
        variables[field] = value;

        if (
          field === "discord_webhook" ||
          field === "discord_role_id" ||
          field === "discord_guild_id"
        ) {
          _set[field] = $(field, "String");
        } else {
          _set[field] = $(field, "Boolean");
        }
      }

      this.saving = true;
      try {
        await this.$apollo.mutate({
          variables,
          mutation: generateMutation({
            update_tournaments_by_pk: [
              {
                pk_columns: {
                  id: this.tournament.id,
                },
                _set,
              },
              {
                __typename: true,
              },
            ],
          }),
        });

        this.dirty = false;
        this.statusOverrideDirty = false;
        toast({
          title: this.$t("tournament.notifications.saved"),
        });
      } catch {
        toast({
          title: this.$t("tournament.notifications.save_error"),
          variant: "destructive",
        });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
