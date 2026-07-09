<script setup lang="ts">
import { Plus, Trash2, ShieldAlert } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <!-- Enable / kill-switch -->
    <PageTransition :delay="0">
      <SettingsSection
        id="steam-presence"
        :title="$t('pages.settings.application.steam_presence.section')"
        :description="
          $t('pages.settings.application.steam_presence.enabled_description')
        "
        clickable-header
        @header-click="save('public.steam_presence_enabled', !enabled)"
      >
        <template #action>
          <Switch
            :model-value="enabled"
            @update:model-value="(v) => save('public.steam_presence_enabled', v)"
          />
        </template>

        <!-- Status tiles, only when enabled (no data fetched otherwise). -->
        <template v-if="enabled">
          <div>
            <div v-if="!status && loading" class="text-sm text-muted-foreground">
              {{ $t("common.loading", "Loading…") }}
            </div>
            <div v-else-if="error" class="space-y-1 text-sm">
              <p class="text-destructive">{{ error }}</p>
              <p class="text-xs text-muted-foreground">
                {{ $t("pages.settings.application.steam_presence.fetch_hint") }}
              </p>
            </div>

            <div v-else-if="status" class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div class="text-3xl font-semibold leading-none tabular-nums">
              {{ status.pool.bots }}
            </div>
            <div class="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {{ $t("pages.settings.application.steam_presence.bots") }}
            </div>
          </div>
          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div
              class="text-3xl font-semibold leading-none tabular-nums"
              :class="status.pool.online > 0 ? 'text-green-400' : ''"
            >
              {{ status.pool.online }}
            </div>
            <div class="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {{ $t("pages.settings.application.steam_presence.online") }}
            </div>
          </div>
          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div class="text-3xl font-semibold leading-none tabular-nums">
              {{ status.pool.watching }}
            </div>
            <div class="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {{ $t("pages.settings.application.steam_presence.watching") }}
            </div>
          </div>
          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div class="text-3xl font-semibold leading-none tabular-nums">
              {{ status.pool.pending }}
            </div>
            <div
              class="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              {{ $t("pages.settings.application.steam_presence.pending") }}
              <FiveStackToolTip>
                <span>{{
                  $t("pages.settings.application.steam_presence.pending_tooltip")
                }}</span>
              </FiveStackToolTip>
            </div>
          </div>
          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div class="text-3xl font-semibold leading-none tabular-nums">
              {{ status.pool.capacity }}
            </div>
            <div
              class="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              {{ $t("pages.settings.application.steam_presence.capacity") }}
              <FiveStackToolTip>
                <span>{{
                  $t("pages.settings.application.steam_presence.capacity_tooltip")
                }}</span>
              </FiveStackToolTip>
            </div>
          </div>
            </div>
          </div>
        </template>
      </SettingsSection>
    </PageTransition>

    <!-- Bots -->
    <PageTransition v-if="enabled" :delay="120">
      <SettingsSection
        id="steam-presence-bots"
        :title="$t('pages.settings.application.steam_presence.bots')"
        :description="$t('pages.settings.application.steam_presence.bots_description')"
      >
        <template #action>
          <Button variant="tactical" size="sm" @click="addBotOpen = true">
            <Plus class="h-4 w-4" />
            {{ $t("pages.settings.application.steam_presence.add_bot") }}
          </Button>
        </template>

        <!-- Empty state -->
        <div
          v-if="status && status.bots.length === 0"
          class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 py-10 text-center"
        >
          <div class="space-y-1">
            <p class="text-sm font-medium">
              {{ $t("pages.settings.application.steam_presence.no_bots") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.settings.application.steam_presence.no_bots_hint") }}
            </p>
          </div>
          <Button variant="tactical" size="sm" @click="addBotOpen = true">
            <Plus class="h-4 w-4" />
            {{ $t("pages.settings.application.steam_presence.add_first_bot") }}
          </Button>
        </div>

        <!-- Bot list -->
        <div v-else-if="status" class="space-y-3">
          <div
            v-for="bot in status.bots"
            :key="bot.id"
            class="rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <!-- identity + remove -->
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="truncate font-medium">{{ bot.username }}</span>
                  <span
                    v-if="bot.online"
                    class="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-400"
                  >
                    <span class="h-1.5 w-1.5 rounded-full bg-green-400" />
                    {{ $t("pages.settings.application.steam_presence.online_yes") }}
                  </span>
                  <span
                    v-else-if="bot.needs2fa"
                    class="inline-flex items-center gap-1 rounded bg-[hsl(var(--tac-amber))]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--tac-amber))]"
                  >
                    <ShieldAlert class="h-3 w-3" />
                    {{ $t("pages.settings.application.steam_presence.needs_2fa") }}
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {{ $t("pages.settings.application.steam_presence.online_no") }}
                  </span>
                </div>
                <a
                  v-if="bot.steamId"
                  :href="`https://steamcommunity.com/profiles/${bot.steamId}`"
                  target="_blank"
                  rel="noopener"
                  class="font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {{ bot.steamId }}
                </a>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                class="-mr-1 -mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                @click="removeAccount(bot)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>

            <!-- watching + capacity -->
            <div class="mt-4 flex items-center gap-5">
              <div class="shrink-0 leading-none">
                <span class="text-lg font-semibold tabular-nums">{{ bot.watching }}</span>
                <span class="ml-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {{ $t("pages.settings.application.steam_presence.watching") }}
                </span>
              </div>
              <div class="flex-1">
                <div class="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>{{ $t("pages.settings.application.steam_presence.capacity") }}</span>
                  <span class="tabular-nums normal-case tracking-normal text-foreground/70">
                    {{ bot.assigned }} / {{ bot.capacity }}
                    <span v-if="bot.steamLevel" class="text-muted-foreground">
                      · lvl {{ bot.steamLevel }}
                    </span>
                  </span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-[hsl(var(--tac-amber))] transition-all"
                    :style="{
                      width:
                        Math.min(
                          100,
                          bot.capacity
                            ? Math.round((bot.assigned / bot.capacity) * 100)
                            : 0,
                        ) + '%',
                    }"
                  />
                </div>
              </div>
            </div>

            <!-- Steam Guard prompt -->
            <div
              v-if="bot.needs2fa"
              class="mt-3 flex flex-col gap-2 rounded-lg border border-[hsl(var(--tac-amber))]/30 bg-[hsl(var(--tac-amber))]/5 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex items-start gap-2 text-sm text-foreground/80">
                <ShieldAlert class="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />
                <span>
                  {{
                    bot.guardType === "email"
                      ? $t("pages.settings.application.steam_presence.needs_2fa_email")
                      : $t("pages.settings.application.steam_presence.needs_2fa_app")
                  }}
                  <span v-if="bot.guardLastWrong" class="text-destructive">
                    {{ $t("pages.settings.application.steam_presence.code_wrong") }}
                  </span>
                </span>
              </div>
              <form class="flex gap-2" @submit.prevent="submitGuard(bot)">
                <input
                  v-model="guardCodes[bot.id]"
                  type="text"
                  autocomplete="one-time-code"
                  :placeholder="$t('pages.settings.application.steam_presence.code_placeholder')"
                  class="w-28 rounded border border-border/60 bg-background/60 px-3 py-1.5 text-center text-sm uppercase tracking-[0.3em] focus:border-[hsl(var(--tac-amber))] focus:outline-none"
                />
                <Button
                  type="submit"
                  size="sm"
                  :disabled="!guardCodes[bot.id] || submittingGuard[bot.id]"
                >
                  {{ $t("pages.settings.application.steam_presence.submit_code") }}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </SettingsSection>
    </PageTransition>

    <!-- Add bot dialog (how it works + form) -->
    <Dialog v-model:open="addBotOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ $t("pages.settings.application.steam_presence.add_bot") }}
          </DialogTitle>
          <DialogDescription>
            {{ $t("pages.settings.application.steam_presence.add_bot_description") }}
          </DialogDescription>
        </DialogHeader>

        <div class="rounded-lg border border-border/60 bg-card/40 p-4">
          <h4
            class="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--tac-amber))]"
          >
            {{ $t("pages.settings.application.steam_presence.setup") }}
          </h4>
          <ol class="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>{{ $t("pages.settings.application.steam_presence.setup_step1") }}</li>
            <li>{{ $t("pages.settings.application.steam_presence.setup_step2") }}</li>
            <li>{{ $t("pages.settings.application.steam_presence.setup_step3") }}</li>
          </ol>
        </div>

        <form class="space-y-3" autocomplete="off" @submit.prevent="addAccount">
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">
              {{ $t("pages.settings.application.steam_presence.username") }}
            </label>
            <input
              v-model="newUsername"
              type="text"
              name="bot_account"
              autocomplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              class="w-full rounded border border-border/60 bg-background/60 px-3 py-2 text-sm focus:border-[hsl(var(--tac-amber))] focus:outline-none"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">
              {{ $t("pages.settings.application.steam_presence.password") }}
            </label>
            <input
              v-model="newBotSecret"
              type="password"
              name="bot_secret"
              autocomplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              class="w-full rounded border border-border/60 bg-background/60 px-3 py-2 text-sm focus:border-[hsl(var(--tac-amber))] focus:outline-none"
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" @click="addBotOpen = false">
            {{ $t("common.cancel", "Cancel") }}
          </Button>
          <Button
            variant="tactical"
            :disabled="adding || !newUsername || !newBotSecret"
            @click="addAccount"
          >
            {{
              adding
                ? $t("common.saving", "Saving…")
                : $t("pages.settings.application.steam_presence.add")
            }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

type PresenceBot = {
  id: string;
  username: string;
  steamId: string | null;
  steamLevel: number | null;
  online: boolean;
  needs2fa: boolean;
  guardType: "email" | "app" | null;
  guardLastWrong: boolean;
  watching: number;
  assigned: number;
  capacity: number;
};

type PresenceAdminStatus = {
  enabled: boolean;
  pool: {
    bots: number;
    online: number;
    watching: number;
    pending: number;
    capacity: number;
  };
  bots: PresenceBot[];
};

const REFRESH_MS = 5000;

export default {
  // Admin-only debug dashboard for the Steam presence bot.
  // (admin middleware is set via definePageMeta in <script setup> above.)
  data() {
    return {
      status: null as PresenceAdminStatus | null,
      loading: false,
      error: null as string | null,
      timer: null as ReturnType<typeof setInterval> | null,
      addBotOpen: false,
      newUsername: "",
      newBotSecret: "",
      adding: false,
      guardCodes: {} as Record<string, string>,
      submittingGuard: {} as Record<string, boolean>,
    };
  },
  computed: {
    settings(): { name: string; value: string }[] {
      return useApplicationSettingsStore().settings;
    },
    enabled(): boolean {
      // Defaults to on: only an explicit "false" disables it.
      return (
        this.settings.find((s) => s.name === "public.steam_presence_enabled")
          ?.value !== "false"
      );
    },
  },
  watch: {
    enabled(on: boolean) {
      if (on) void this.fetchStatus();
      else this.status = null;
    },
  },
  mounted() {
    void this.fetchStatus();
    this.timer = setInterval(() => void this.fetchStatus(), REFRESH_MS);
  },
  beforeUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  },
  methods: {
    async fetchStatus() {
      // Don't request any data while the bot is disabled.
      if (!this.enabled) {
        this.status = null;
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        const { data } = await (this.$apollo as any).query({
          query: generateQuery({
            steamPresenceAdminStatus: {
              enabled: true,
              pool: {
                bots: true,
                online: true,
                watching: true,
                pending: true,
                capacity: true,
              },
              bots: {
                id: true,
                username: true,
                steamId: true,
                steamLevel: true,
                online: true,
                needs2fa: true,
                guardType: true,
                guardLastWrong: true,
                watching: true,
                assigned: true,
                capacity: true,
              },
            },
          }),
          fetchPolicy: "no-cache",
        });
        this.status = data.steamPresenceAdminStatus as PresenceAdminStatus;
      } catch (error) {
        this.error =
          this.$t("pages.settings.application.steam_presence.fetch_failed") +
          ": " +
          ((error as Error)?.message ?? String(error));
      } finally {
        this.loading = false;
      }
    },
    async addAccount() {
      if (!this.newUsername || !this.newBotSecret) {
        return;
      }
      this.adding = true;
      try {
        await (this.$apollo as any).mutate({
          mutation: generateMutation({
            addSteamPresenceBotAccount: [
              {
                username: this.newUsername,
                bot_secret: this.newBotSecret,
              },
              { success: true },
            ],
          }),
        });
        toast({
          title: this.$t(
            "pages.settings.application.steam_presence.account_added",
          ),
        });
        this.newUsername = "";
        this.newBotSecret = "";
        this.addBotOpen = false;
        await this.fetchStatus();
      } catch (error) {
        toast({
          variant: "destructive",
          title: this.$t(
            "pages.settings.application.steam_presence.account_add_failed",
          ),
          description: (error as Error)?.message ?? String(error),
        });
      } finally {
        this.adding = false;
      }
    },
    async submitGuard(bot: PresenceBot) {
      const code = (this.guardCodes[bot.id] || "").trim();
      if (!code) {
        return;
      }
      this.submittingGuard[bot.id] = true;
      try {
        await (this.$apollo as any).mutate({
          mutation: generateMutation({
            submitSteamPresenceSteamGuard: [
              { account_id: bot.id, code },
              { success: true },
            ],
          }),
        });
        toast({
          title: this.$t(
            "pages.settings.application.steam_presence.code_submitted",
          ),
        });
        this.guardCodes[bot.id] = "";
        setTimeout(() => void this.fetchStatus(), 2000);
      } catch (error) {
        toast({
          variant: "destructive",
          title: this.$t(
            "pages.settings.application.steam_presence.code_failed",
          ),
          description: (error as Error)?.message ?? String(error),
        });
      } finally {
        this.submittingGuard[bot.id] = false;
      }
    },
    async removeAccount(bot: PresenceBot) {
      if (
        !confirm(
          this.$t("pages.settings.application.steam_presence.remove_confirm", {
            name: bot.username,
          }),
        )
      ) {
        return;
      }
      try {
        await (this.$apollo as any).mutate({
          mutation: generateMutation({
            removeSteamPresenceBotAccount: [
              { account_id: bot.id },
              { success: true },
            ],
          }),
        });
        toast({
          title: this.$t(
            "pages.settings.application.steam_presence.account_removed",
          ),
        });
        await this.fetchStatus();
      } catch (error) {
        toast({
          variant: "destructive",
          title: this.$t(
            "pages.settings.application.steam_presence.account_remove_failed",
          ),
          description: (error as Error)?.message ?? String(error),
        });
      }
    },
    async save(name: string, value: boolean) {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [{ name, value: value ? "true" : "false" }],
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
        title: this.$t("pages.settings.application.steam_presence.updated"),
      });
    },
  },
};
</script>
