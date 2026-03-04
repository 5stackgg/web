<template>
  <div class="grid gap-6">
    <div>
      <h3 class="text-lg font-medium">
        {{ $t("tournament.notifications.title") }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ $t("tournament.notifications.description") }}
      </p>
    </div>

    <Card variant="gradient">
      <div class="p-6 space-y-6">
        <div
          class="flex items-center justify-between rounded-lg border p-4 cursor-pointer select-none"
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
            <button
              v-if="
                form.discord_notifications_enabled !== null &&
                form.discord_notifications_enabled !==
                  globalNotificationsEnabled
              "
              class="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              :title="$t('tournament.notifications.using_global')"
              @click.stop="
                form.discord_notifications_enabled = null;
                dirty = true;
              "
            >
              <RotateCcw class="h-4 w-4" />
            </button>
            <Switch
              @click.stop
              :model-value="form.discord_notifications_enabled === true"
              @update:model-value="updateMaster($event)"
            />
          </div>
        </div>
        <p
          v-if="form.discord_notifications_enabled === null"
          class="text-xs text-muted-foreground italic"
        >
          {{ $t("tournament.notifications.using_global") }}
          <template v-if="isAdmin"
            >({{
              globalNotificationsEnabled
                ? $t("tournament.notifications.enabled")
                : $t("tournament.notifications.disabled")
            }})</template
          >
        </p>
      </div>
    </Card>

    <Card variant="gradient">
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
              :placeholder="$t('tournament.notifications.webhook_placeholder')"
              @update:model-value="updateWebhook($event)"
            />
            <button
              v-if="
                form.discord_webhook !== null &&
                form.discord_webhook !== globalWebhook
              "
              class="text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
              :title="$t('tournament.notifications.using_global')"
              @click="
                form.discord_webhook = null;
                dirty = true;
              "
            >
              <RotateCcw class="h-4 w-4" />
            </button>
          </div>
          <p
            v-if="form.discord_webhook === null && globalWebhook"
            class="text-xs text-muted-foreground italic"
          >
            {{ $t("tournament.notifications.using_global") }}
            <span v-if="isAdmin" class="font-mono"
              >({{ maskedGlobalWebhook }})</span
            >
          </p>
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
              :placeholder="$t('tournament.notifications.role_id_placeholder')"
              @update:model-value="updateRoleId($event)"
            />
            <button
              v-if="
                form.discord_role_id !== null &&
                form.discord_role_id !== globalRoleId
              "
              class="text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
              :title="$t('tournament.notifications.using_global')"
              @click="
                form.discord_role_id = null;
                dirty = true;
              "
            >
              <RotateCcw class="h-4 w-4" />
            </button>
          </div>
          <p
            v-if="form.discord_role_id === null && globalRoleId"
            class="text-xs text-muted-foreground italic"
          >
            {{ $t("tournament.notifications.using_global") }}
            <span v-if="isAdmin" class="font-mono">({{ globalRoleId }})</span>
          </p>
        </div>
      </div>
    </Card>

    <Card variant="gradient">
      <div class="p-6 space-y-6">
        <div>
          <h4 class="text-base font-medium mb-3">
            {{ $t("tournament.notifications.statuses_title") }}
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="status in MATCH_STATUSES"
              :key="status"
              class="flex items-center justify-between rounded-lg border p-3 cursor-pointer select-none"
              role="button"
              tabindex="0"
              @click="toggleStatus(status)"
              @keydown.enter.prevent="toggleStatus(status)"
              @keydown.space.prevent="toggleStatus(status)"
            >
              <div>
                <span class="text-sm font-medium">{{
                  $t(`tournament.notifications.status.${status}`)
                }}</span>
                <span
                  v-if="form[`discord_notify_${status}`] === null"
                  class="text-[10px] text-muted-foreground ml-1.5"
                  >({{ $t("tournament.notifications.default") }})</span
                >
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="
                    form[`discord_notify_${status}`] !== null &&
                    form[`discord_notify_${status}`] !==
                      getGlobalStatusValue(status)
                  "
                  class="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  :title="$t('tournament.notifications.using_global')"
                  @click.stop="
                    form[`discord_notify_${status}`] = null;
                    dirty = true;
                  "
                >
                  <RotateCcw class="h-4 w-4" />
                </button>
                <Switch
                  @click.stop
                  :model-value="resolveStatusToggle(status)"
                  @update:model-value="updateStatusValue(status, $event)"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-base font-medium mb-3">
            {{ $t("tournament.notifications.events_title") }}
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              class="flex items-center justify-between rounded-lg border p-3 cursor-pointer select-none"
              role="button"
              tabindex="0"
              @click="toggleStatus('MapPaused')"
              @keydown.enter.prevent="toggleStatus('MapPaused')"
              @keydown.space.prevent="toggleStatus('MapPaused')"
            >
              <div>
                <span class="text-sm font-medium">{{
                  $t("tournament.notifications.map_paused")
                }}</span>
                <span
                  v-if="form.discord_notify_MapPaused === null"
                  class="text-[10px] text-muted-foreground ml-1.5"
                  >({{ $t("tournament.notifications.default") }})</span
                >
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="
                    form.discord_notify_MapPaused !== null &&
                    form.discord_notify_MapPaused !==
                      getGlobalStatusValue('MapPaused')
                  "
                  class="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  :title="$t('tournament.notifications.using_global')"
                  @click.stop="
                    form.discord_notify_MapPaused = null;
                    dirty = true;
                  "
                >
                  <RotateCcw class="h-4 w-4" />
                </button>
                <Switch
                  @click.stop
                  :model-value="resolveStatusToggle('MapPaused')"
                  @update:model-value="updateStatusValue('MapPaused', $event)"
                />
              </div>
            </div>
          </div>
        </div>
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
import { $, e_match_status_enum } from "~/generated/zeus";
import { RotateCcw } from "lucide-vue-next";
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

const DISCORD_FIELDS = [
  "discord_notifications_enabled",
  "discord_webhook",
  "discord_role_id",
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

export default {
  components: {
    RotateCcw,
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
      form: this.buildForm(this.tournament),
      saving: false,
      dirty: false,
    };
  },
  watch: {
    tournament: {
      handler(newTournament) {
        if (newTournament && !this.dirty) {
          this.form = this.buildForm(newTournament);
        }
      },
    },
  },
  computed: {
    isAdmin() {
      return useAuthStore().isAdmin;
    },
    settings() {
      return useApplicationSettingsStore().settings;
    },
    globalWebhook() {
      const s = this.settings.find(
        (s: { name: string }) =>
          s.name === "discord_match_notifications_webhook",
      );
      return s?.value || "";
    },
    globalRoleId() {
      const s = this.settings.find(
        (s: { name: string }) =>
          s.name === "discord_match_notifications_role_id",
      );
      return s?.value || "";
    },
    globalNotificationsEnabled(): boolean {
      const s = this.settings.find(
        (s: { name: string }) =>
          s.name === "discord_match_notifications_enabled",
      );
      return s?.value === "true";
    },
    maskedGlobalWebhook(): string {
      const url = this.globalWebhook;
      if (!url) return "";
      if (url.length <= 24) return url;
      return url.slice(0, 20) + "..." + url.slice(-4);
    },
  },
  methods: {
    buildForm(tournament: Record<string, any>) {
      const form: Record<string, any> = {};
      for (const field of DISCORD_FIELDS) {
        form[field] = tournament[field] ?? null;
      }
      return form;
    },
    getGlobalStatusValue(status: string): boolean {
      const s = this.settings.find(
        (s: { name: string }) => s.name === `discord_match_notify_${status}`,
      );
      return s?.value === "true";
    },
    resolveStatusToggle(status: string): boolean {
      const val = this.form[`discord_notify_${status}`];
      if (val !== null) return val;
      return this.getGlobalStatusValue(status);
    },
    toggleMaster() {
      const current = this.form.discord_notifications_enabled;
      const newVal =
        current === null ? !this.globalNotificationsEnabled : !current;
      this.form.discord_notifications_enabled =
        newVal === this.globalNotificationsEnabled ? null : newVal;
      this.dirty = true;
    },
    updateMaster(val: boolean) {
      this.form.discord_notifications_enabled =
        val === this.globalNotificationsEnabled ? null : val;
      this.dirty = true;
    },
    toggleStatus(status: string) {
      const key = `discord_notify_${status}`;
      const current = this.form[key];
      const globalVal = this.getGlobalStatusValue(status);
      const newVal = current === null ? !globalVal : !current;
      this.form[key] = newVal === globalVal ? null : newVal;
      this.dirty = true;
    },
    updateStatusValue(status: string, val: boolean) {
      const key = `discord_notify_${status}`;
      this.form[key] = val === this.getGlobalStatusValue(status) ? null : val;
      this.dirty = true;
    },
    updateWebhook(value: string) {
      const v = value || null;
      this.form.discord_webhook = v && v !== this.globalWebhook ? v : null;
      this.dirty = true;
    },
    updateRoleId(value: string) {
      const v = value || null;
      this.form.discord_role_id = v && v !== this.globalRoleId ? v : null;
      this.dirty = true;
    },
    async save() {
      const variables: Record<string, any> = {};
      const _set: Record<string, any> = {};

      for (const field of DISCORD_FIELDS) {
        let value = this.form[field];
        if (
          (field === "discord_webhook" || field === "discord_role_id") &&
          value === ""
        ) {
          value = null;
        }
        variables[field] = value;

        if (field === "discord_webhook" || field === "discord_role_id") {
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
