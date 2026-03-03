<script setup lang="ts">
import { Card } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Button } from "@/components/ui/button";
import { e_match_status_enum } from "~/generated/zeus";
import { RotateCcw } from "lucide-vue-next";

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
</script>

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
          @click="toggleMaster"
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
              v-if="form.discord_notifications_enabled !== null"
              class="text-xs text-muted-foreground hover:text-foreground transition-colors"
              :title="$t('tournament.notifications.using_global')"
              @click.stop="form.discord_notifications_enabled = null"
            >
              <RotateCcw class="h-3.5 w-3.5" />
            </button>
            <Switch
              @click.stop
              :model-value="form.discord_notifications_enabled === true"
              @update:model-value="
                form.discord_notifications_enabled = $event ? true : false
              "
            />
          </div>
        </div>
        <p
          v-if="form.discord_notifications_enabled === null"
          class="text-xs text-muted-foreground italic"
        >
          {{ $t("tournament.notifications.using_global") }}
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
              v-model="form.discord_webhook"
              :placeholder="
                globalWebhook ||
                $t('tournament.notifications.webhook_placeholder')
              "
            />
            <button
              v-if="form.discord_webhook !== null"
              class="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              :title="$t('tournament.notifications.using_global')"
              @click="form.discord_webhook = null"
            >
              <RotateCcw class="h-4 w-4" />
            </button>
          </div>
          <p
            v-if="form.discord_webhook === null && globalWebhook"
            class="text-xs text-muted-foreground italic"
          >
            {{ $t("tournament.notifications.using_global") }}: {{ globalWebhook }}
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
              v-model="form.discord_role_id"
              :placeholder="
                globalRoleId ||
                $t('tournament.notifications.role_id_placeholder')
              "
            />
            <button
              v-if="form.discord_role_id !== null"
              class="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              :title="$t('tournament.notifications.using_global')"
              @click="form.discord_role_id = null"
            >
              <RotateCcw class="h-4 w-4" />
            </button>
          </div>
          <p
            v-if="form.discord_role_id === null && globalRoleId"
            class="text-xs text-muted-foreground italic"
          >
            {{ $t("tournament.notifications.using_global") }}: {{ globalRoleId }}
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
              @click="toggleStatus(status)"
            >
              <span class="text-sm font-medium">{{
                $t(`tournament.notifications.status.${status}`)
              }}</span>
              <div class="flex items-center gap-2">
                <button
                  v-if="form[`discord_notify_${status}`] !== null"
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  :title="$t('tournament.notifications.using_global')"
                  @click.stop="form[`discord_notify_${status}`] = null"
                >
                  <RotateCcw class="h-3.5 w-3.5" />
                </button>
                <Switch
                  @click.stop
                  :model-value="resolveStatusToggle(status)"
                  @update:model-value="
                    form[`discord_notify_${status}`] = $event ? true : false
                  "
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
              @click="toggleMapPaused"
            >
              <span class="text-sm font-medium">{{ $t("tournament.notifications.map_paused") }}</span>
              <div class="flex items-center gap-2">
                <button
                  v-if="form.discord_notify_MapPaused !== null"
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  :title="$t('tournament.notifications.using_global')"
                  @click.stop="form.discord_notify_MapPaused = null"
                >
                  <RotateCcw class="h-3.5 w-3.5" />
                </button>
                <Switch
                  @click.stop
                  :model-value="resolveStatusToggle('MapPaused')"
                  @update:model-value="
                    form.discord_notify_MapPaused = $event ? true : false
                  "
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
import { $ } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

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
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      form: this.buildForm(this.tournament),
      saving: false,
    };
  },
  watch: {
    tournament: {
      handler(newTournament) {
        if (newTournament) {
          this.form = this.buildForm(newTournament);
        }
      },
    },
  },
  computed: {
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
      if (this.form.discord_notifications_enabled === true) {
        this.form.discord_notifications_enabled = false;
      } else {
        this.form.discord_notifications_enabled = true;
      }
    },
    toggleStatus(status: string) {
      const key = `discord_notify_${status}`;
      if (this.form[key] === true) {
        this.form[key] = false;
      } else {
        this.form[key] = true;
      }
    },
    toggleMapPaused() {
      if (this.form.discord_notify_MapPaused === true) {
        this.form.discord_notify_MapPaused = false;
      } else {
        this.form.discord_notify_MapPaused = true;
      }
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
