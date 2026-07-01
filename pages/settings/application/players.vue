<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, X } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { onMounted } from "vue";
import { useRecomputeElo } from "~/composables/useRecomputeElo";
import { useReindexPlayers } from "~/composables/useReindexPlayers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const { t } = useI18n();
const showRefreshDialog = ref(false);
const showScanDialog = ref(false);
const scanning = ref(false);
const showEloDialog = ref(false);

const {
  status: eloStatus,
  running: eloRunning,
  progress: eloProgress,
  eta: eloEta,
  starting: eloStarting,
  canceling: eloCanceling,
  startRecompute,
  cancelRecompute,
  ensureLoaded: ensureEloLoaded,
} = useRecomputeElo();

const {
  status: reindexStatus,
  running: reindexRunning,
  progress: reindexProgress,
  eta: reindexEta,
  starting: reindexStarting,
  canceling: reindexCanceling,
  startReindex,
  cancelReindex,
  ensureLoaded: ensureReindexLoaded,
} = useReindexPlayers();

onMounted(() => {
  void ensureEloLoaded();
  void ensureReindexLoaded();
});

async function doRecomputeElo() {
  showEloDialog.value = false;
  await startRecompute();
}

async function doRefreshAllPlayers() {
  showRefreshDialog.value = false;
  await startReindex();
}

async function doScanSteamBans() {
  scanning.value = true;
  showScanDialog.value = false;

  try {
    await useNuxtApp().$apollo.defaultClient.mutate({
      mutation: gql`
        mutation ScanSteamBans {
          scanSteamBans {
            success
          }
        }
      `,
    });

    toast({
      title: t("pages.settings.application.players.scan_queued"),
    });
  } catch (error: any) {
    toast({
      title: t("pages.settings.application.players.scan_failed"),
      description:
        error?.message ||
        t("pages.settings.application.players.error_occurred"),
      variant: "destructive",
    });
  } finally {
    scanning.value = false;
  }
}
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <form class="space-y-6" @submit.prevent="updateSettings">
          <SettingsSection
            id="registration"
            :title="
              $t('pages.settings.application.players.force_name_registration')
            "
            :description="
              $t(
                'pages.settings.application.players.force_name_registration_description',
              )
            "
            clickable-header
            @header-click="togglePlayerNameRegistration"
          >
            <template #action>
              <Switch
                :model-value="playerNameRegistration"
                @update:model-value="togglePlayerNameRegistration"
              />
            </template>
          </SettingsSection>

          <SettingsSection
            id="permissions"
            :title="
              $t('pages.settings.application.players.permissions_section')
            "
          >
            <FormField
              v-slot="{ componentField }"
              name="public.create_matches_role"
            >
              <FormItem>
                <FormLabel>{{
                  $t("pages.settings.application.create_matches_role")
                }}</FormLabel>
                <FormControl>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          :value="role.value"
                          v-for="role in roles"
                          :key="role.value"
                        >
                          <span>{{ role.display }}</span>
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField
              v-slot="{ componentField }"
              name="public.create_tournaments_role"
            >
              <FormItem>
                <FormLabel>{{
                  $t("pages.settings.application.create_tournaments_role")
                }}</FormLabel>
                <FormControl>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          :value="role.value"
                          v-for="role in roles"
                          :key="role.value"
                        >
                          <span class="capitalize">{{ role.display }}</span>
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField
              v-slot="{ componentField }"
              name="dedicated_servers_min_role_to_connect"
            >
              <FormItem>
                <FormLabel>{{
                  $t(
                    "pages.settings.application.dedicated_servers_min_role_to_connect",
                  )
                }}</FormLabel>
                <FormControl>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          :value="role.value"
                          v-for="role in roles"
                          :key="role.value"
                        >
                          <span class="capitalize">{{ role.display }}</span>
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </SettingsSection>

          <SettingsSaveBar
            :form="form"
            :submitting="submitting"
            @save="updateSettings"
          />
        </form>

        <section id="danger-zone" class="scroll-mt-4">
          <div class="rounded-lg border border-destructive/40 bg-destructive/5">
            <div class="p-6 space-y-6">
              <div class="flex items-start gap-3">
                <AlertTriangle class="h-5 w-5 shrink-0 text-destructive" />
                <div class="min-w-0 flex-1 space-y-0.5">
                  <h3
                    class="text-sm font-semibold uppercase tracking-wider text-destructive"
                  >
                    {{
                      $t("pages.settings.application.players.danger_zone_title")
                    }}
                  </h3>
                  <p class="text-sm text-muted-foreground">
                    {{
                      $t(
                        "pages.settings.application.players.danger_zone_description",
                      )
                    }}
                  </p>
                </div>
              </div>

              <div class="border-t border-destructive/20 pt-4 space-y-3">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0 space-y-0.5">
                    <p class="text-sm font-medium">
                      {{
                        $t(
                          "pages.settings.application.players.recompute_elo_title",
                        )
                      }}
                    </p>
                    <p class="text-sm text-muted-foreground">
                      {{
                        $t(
                          "pages.settings.application.players.recompute_elo_description",
                        )
                      }}
                    </p>
                  </div>
                  <div class="shrink-0 flex items-center gap-2">
                    <Button
                      v-if="eloRunning"
                      type="button"
                      size="sm"
                      variant="ghost"
                      :disabled="eloCanceling"
                      class="flex items-center gap-2"
                      @click="cancelRecompute"
                    >
                      <Spinner v-if="eloCanceling" class="h-4 w-4" />
                      <X v-else class="h-4 w-4" />
                      {{
                        $t("pages.settings.application.players.cancel_button")
                      }}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      :disabled="eloStarting || eloRunning"
                      class="flex items-center gap-2"
                      @click="showEloDialog = true"
                    >
                      <Spinner
                        v-if="eloStarting || eloRunning"
                        class="h-4 w-4"
                      />
                      {{
                        eloStarting || eloRunning
                          ? $t(
                              "pages.settings.application.players.recomputing_elo",
                            )
                          : $t(
                              "pages.settings.application.players.recompute_elo_button",
                            )
                      }}
                    </Button>
                  </div>
                </div>

                <div
                  v-if="eloStatus && (eloRunning || eloStatus.finished_at)"
                  class="space-y-1"
                >
                  <Progress v-if="eloRunning" :model-value="eloProgress" />
                  <div
                    class="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <span v-if="eloRunning">
                      {{
                        $t(
                          "pages.settings.application.players.progress_running",
                          {
                            processed: eloStatus.completed,
                            total: eloStatus.total,
                            percent: eloProgress,
                          },
                        )
                      }}
                      <template v-if="eloStatus.failed">
                        ·
                        {{
                          $t(
                            "pages.settings.application.players.progress_failed_count",
                            { failed: eloStatus.failed },
                          )
                        }}
                      </template>
                    </span>
                    <span v-else-if="eloStatus.canceled">
                      {{
                        $t(
                          "pages.settings.application.players.progress_canceled",
                          {
                            completed: eloStatus.completed,
                            total: eloStatus.total,
                          },
                        )
                      }}
                    </span>
                    <span v-else>
                      {{
                        $t(
                          "pages.settings.application.players.progress_completed",
                          { total: eloStatus.completed },
                        )
                      }}
                    </span>
                    <span v-if="eloRunning && eloEta">
                      {{
                        $t("pages.settings.application.players.progress_eta", {
                          eta: eloEta,
                        })
                      }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="border-t border-destructive/20 pt-4 space-y-3">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0 space-y-0.5">
                    <p class="text-sm font-medium">
                      {{
                        $t(
                          "pages.settings.application.players.refresh_all_title",
                        )
                      }}
                    </p>
                    <p class="text-sm text-muted-foreground">
                      {{
                        $t(
                          "pages.settings.application.players.refresh_all_description",
                        )
                      }}
                    </p>
                  </div>
                  <div class="shrink-0 flex items-center gap-2">
                    <Button
                      v-if="reindexRunning"
                      type="button"
                      size="sm"
                      variant="ghost"
                      :disabled="reindexCanceling"
                      class="flex items-center gap-2"
                      @click="cancelReindex"
                    >
                      <Spinner v-if="reindexCanceling" class="h-4 w-4" />
                      <X v-else class="h-4 w-4" />
                      {{
                        $t("pages.settings.application.players.cancel_button")
                      }}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      :disabled="reindexStarting || reindexRunning"
                      class="flex items-center gap-2"
                      @click="showRefreshDialog = true"
                    >
                      <Spinner
                        v-if="reindexStarting || reindexRunning"
                        class="h-4 w-4"
                      />
                      {{
                        reindexStarting || reindexRunning
                          ? $t("pages.settings.application.players.refreshing")
                          : $t(
                              "pages.settings.application.players.refresh_button",
                            )
                      }}
                    </Button>
                  </div>
                </div>

                <div
                  v-if="
                    reindexStatus &&
                    (reindexRunning || reindexStatus.finished_at)
                  "
                  class="space-y-1"
                >
                  <Progress
                    v-if="reindexRunning"
                    :model-value="reindexProgress"
                  />
                  <div
                    class="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <span v-if="reindexRunning">
                      {{
                        $t(
                          "pages.settings.application.players.progress_running",
                          {
                            processed: reindexStatus.completed,
                            total: reindexStatus.total,
                            percent: reindexProgress,
                          },
                        )
                      }}
                      <template v-if="reindexStatus.failed">
                        ·
                        {{
                          $t(
                            "pages.settings.application.players.progress_failed_count",
                            { failed: reindexStatus.failed },
                          )
                        }}
                      </template>
                    </span>
                    <span v-else-if="reindexStatus.canceled">
                      {{
                        $t(
                          "pages.settings.application.players.progress_canceled",
                          {
                            completed: reindexStatus.completed,
                            total: reindexStatus.total,
                          },
                        )
                      }}
                    </span>
                    <span v-else>
                      {{
                        $t(
                          "pages.settings.application.players.progress_completed",
                          { total: reindexStatus.completed },
                        )
                      }}
                    </span>
                    <span v-if="reindexRunning && reindexEta">
                      {{
                        $t("pages.settings.application.players.progress_eta", {
                          eta: reindexEta,
                        })
                      }}
                    </span>
                  </div>
                </div>
              </div>

              <div
                class="flex items-start justify-between gap-4 border-t border-destructive/20 pt-4"
              >
                <div class="min-w-0 space-y-0.5">
                  <p class="text-sm font-medium">
                    {{
                      $t("pages.settings.application.players.scan_bans_title")
                    }}
                  </p>
                  <p class="text-sm text-muted-foreground">
                    {{
                      $t(
                        "pages.settings.application.players.scan_bans_description",
                      )
                    }}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  :disabled="scanning"
                  class="shrink-0 flex items-center gap-2"
                  @click="showScanDialog = true"
                >
                  <Spinner v-if="scanning" class="h-4 w-4" />
                  {{
                    scanning
                      ? $t("pages.settings.application.players.scanning")
                      : $t("pages.settings.application.players.scan_button")
                  }}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <AlertDialog v-model:open="showEloDialog">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{
                  $t(
                    "pages.settings.application.players.recompute_elo_dialog_title",
                  )
                }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  $t(
                    "pages.settings.application.players.recompute_elo_dialog_description",
                  )
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {{ $t("common.cancel") }}
              </AlertDialogCancel>
              <AlertDialogAction @click="doRecomputeElo">
                {{
                  $t("pages.settings.application.players.recompute_elo_button")
                }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog v-model:open="showRefreshDialog">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{
                  $t("pages.settings.application.players.refresh_dialog_title")
                }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  $t(
                    "pages.settings.application.players.refresh_dialog_description",
                  )
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {{ $t("common.cancel") }}
              </AlertDialogCancel>
              <AlertDialogAction @click="doRefreshAllPlayers">
                {{ $t("pages.settings.application.players.refresh_button") }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog v-model:open="showScanDialog">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{ $t("pages.settings.application.players.scan_dialog_title") }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  $t(
                    "pages.settings.application.players.scan_dialog_description",
                  )
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {{ $t("common.cancel") }}
              </AlertDialogCancel>
              <AlertDialogAction @click="doScanSteamBans">
                {{ $t("pages.settings.application.players.scan_button") }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import {
  e_player_roles_enum,
  settings_constraint,
  settings_update_column,
} from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      submitting: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            dedicated_servers_min_role_to_connect: z
              .string()
              .default(e_player_roles_enum.user),
            public: z.object({
              player_name_registration: z.string().default("false"),
              create_matches_role: z.string().default(e_player_roles_enum.user),
              create_tournaments_role: z
                .string()
                .default(e_player_roles_enum.user),
            }),
          }),
        ),
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal: Array<{ name: string; value: string | null }>) {
        for (const setting of newVal) {
          if (setting.value == null || setting.value === "") {
            continue;
          }
          (this.form.setFieldValue as any)(setting.name, setting.value);
        }
        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  methods: {
    roleOrDefault(value: unknown): string {
      return typeof value === "string" && value.length > 0
        ? value
        : e_player_roles_enum.user;
    },
    async togglePlayerNameRegistration() {
      await (this as any).$apollo.mutate({
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

      toast({
        title: this.$t("pages.settings.application.update_success") as string,
      });
    },
    async updateSettings() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        const values = this.form.values as any;
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: [
                  {
                    name: "public.create_matches_role",
                    value: this.roleOrDefault(
                      values.public?.create_matches_role,
                    ),
                  },
                  {
                    name: "public.create_tournaments_role",
                    value: this.roleOrDefault(
                      values.public?.create_tournaments_role,
                    ),
                  },
                  {
                    name: "dedicated_servers_min_role_to_connect",
                    value: this.roleOrDefault(
                      values.dedicated_servers_min_role_to_connect,
                    ),
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
          title: this.$t("pages.settings.application.update_success") as string,
        });
      } finally {
        this.submitting = false;
      }
    },
  },
  computed: {
    roles() {
      return [
        { value: e_player_roles_enum.user, display: this.$t("roles.user") },
        {
          value: e_player_roles_enum.verified_user,
          display: this.$t("roles.verified_user"),
        },
        {
          value: e_player_roles_enum.streamer,
          display: this.$t("roles.streamer"),
        },
        {
          value: e_player_roles_enum.match_organizer,
          display: this.$t("roles.match_organizer"),
        },
        {
          value: e_player_roles_enum.tournament_organizer,
          display: this.$t("roles.tournament_organizer"),
        },
        {
          value: e_player_roles_enum.administrator,
          display: this.$t("roles.administrator"),
        },
      ];
    },
    settings() {
      return useApplicationSettingsStore().settings;
    },
    playerNameRegistration() {
      const playerNameRegistrationSetting = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "public.player_name_registration",
      );

      if (playerNameRegistrationSetting) {
        return playerNameRegistrationSetting.value === "true";
      }

      return false;
    },
  },
};
</script>
