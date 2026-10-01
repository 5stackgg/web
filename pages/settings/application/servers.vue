<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle } from "lucide-vue-next";
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
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="plugin-runtime"
          :title="$t('pages.settings.application.servers.plugin_runtime_section')"
          :description="
            $t('pages.settings.application.servers.plugin_runtime_description')
          "
        >
          <FormField v-slot="{ componentField }" name="game_server_plugin_runtime">
            <FormItem>
              <Select v-bind="componentField" :disabled="pluginRuntimeLocked">
                <FormControl>
                  <SelectTrigger class="w-full sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="swiftlys2"> SwiftlyS2 </SelectItem>
                  <SelectItem value="counterstrikesharp">
                    CounterStrikeSharp
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          </FormField>

          <p v-if="pluginRuntimeLocked" class="text-sm text-muted-foreground">
            {{ $t("pages.settings.application.servers.plugin_runtime_locked") }}
          </p>
          <p v-else class="text-sm text-muted-foreground">
            {{ $t("pages.settings.application.servers.plugin_runtime_warning") }}
          </p>
        </SettingsSection>

        <SettingsSection
          id="performance"
          :title="$t('pages.settings.application.servers.cpu_section')"
          :description="
            $t('pages.settings.application.servers.enable_cpu_pinning_description')
          "
          clickable-header
          @header-click="toggleCpuPinning"
        >
          <template #action>
            <Switch
              :model-value="cpuPinningEnabled"
              @update:model-value="toggleCpuPinning"
            />
          </template>

          <FormField
            v-if="cpuPinningEnabled"
            v-slot="{ componentField }"
            name="number_of_cpus_per_server"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.servers.number_of_cpus_per_server",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.servers.number_of_cpus_per_server_description",
                )
              }}</FormDescription>
              <Input type="number" v-bind="componentField" min="1" />
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="disk"
          :title="$t('pages.settings.application.servers.disk_section')"
        >
          <FormField
            v-slot="{ componentField }"
            name="reserved_disk_space_fresh_gb"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.servers.reserved_disk_space_fresh_gb",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.servers.reserved_disk_space_fresh_gb_description",
                )
              }}</FormDescription>
              <Input type="number" v-bind="componentField" min="0" />
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField
            v-slot="{ componentField }"
            name="reserved_disk_space_existing_gb"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.servers.reserved_disk_space_existing_gb",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.servers.reserved_disk_space_existing_gb_description",
                )
              }}</FormDescription>
              <Input type="number" v-bind="componentField" min="0" />
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="player-sessions"
          :title="
            $t('pages.settings.application.servers.player_sessions_section')
          "
          :description="
            $t(
              'pages.settings.application.servers.player_sessions_description',
            )
          "
        >
          <FormField
            v-slot="{ componentField }"
            name="player_session_retention_days"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.servers.player_session_retention_days",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.servers.player_session_retention_days_description",
                  {
                    min: PLAYER_SESSION_RETENTION.min,
                    max: PLAYER_SESSION_RETENTION.max,
                  },
                )
              }}</FormDescription>
              <Input
                type="number"
                v-bind="componentField"
                :min="PLAYER_SESSION_RETENTION.min"
                :max="PLAYER_SESSION_RETENTION.max"
                class="sm:max-w-xs"
              />
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
    </PageTransition>

    <PageTransition :delay="100">
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
                    $t("pages.settings.application.servers.danger_zone_title")
                  }}
                </h3>
                <p class="text-sm text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.servers.danger_zone_description",
                    )
                  }}
                </p>
              </div>
            </div>

            <div
              class="flex items-start justify-between gap-4 border-t border-destructive/20 pt-4"
            >
              <div class="min-w-0 space-y-0.5">
                <p class="text-sm font-medium">
                  {{
                    $t("pages.settings.application.servers.cleanup_nodes_title")
                  }}
                </p>
                <p class="text-sm text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.servers.cleanup_nodes_description",
                    )
                  }}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                :disabled="cleaningUpNodes"
                class="shrink-0 flex items-center gap-2"
                @click="showCleanupNodesDialog = true"
              >
                <Spinner v-if="cleaningUpNodes" class="h-4 w-4" />
                {{
                  cleaningUpNodes
                    ? $t(
                        "pages.settings.application.servers.cleanup_nodes_running",
                      )
                    : $t(
                        "pages.settings.application.servers.cleanup_nodes_button",
                      )
                }}
              </Button>
            </div>
          </div>
        </div>

        <AlertDialog v-model:open="showCleanupNodesDialog">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{
                  $t(
                    "pages.settings.application.servers.cleanup_nodes_dialog_title",
                  )
                }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  $t(
                    "pages.settings.application.servers.cleanup_nodes_dialog_description",
                  )
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {{ $t("common.cancel") }}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                @click="cleanupRemovedNodes"
              >
                {{
                  $t("pages.settings.application.servers.cleanup_nodes_button")
                }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import gql from "graphql-tag";

// The api clamps to the same bounds: the weekly leaderboards read raw
// sessions, so a week is the floor.
const PLAYER_SESSION_RETENTION = { min: 7, max: 90, fallback: 7 };

export default {
  data() {
    return {
      submitting: false,
      cleaningUpNodes: false,
      showCleanupNodesDialog: false,
      PLAYER_SESSION_RETENTION,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            game_server_plugin_runtime: z.string().default("swiftlys2"),
            number_of_cpus_per_server: z.number().min(1).default(1),
            reserved_disk_space_fresh_gb: z.number().min(0).default(120),
            reserved_disk_space_existing_gb: z.number().min(0).default(60),
            player_session_retention_days: z
              .number()
              .int()
              .min(PLAYER_SESSION_RETENTION.min)
              .max(PLAYER_SESSION_RETENTION.max)
              .default(PLAYER_SESSION_RETENTION.fallback),
          }),
        ),
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler() {
        for (const setting of this.settings) {
          if (
            setting.name === "number_of_cpus_per_server" ||
            setting.name === "reserved_disk_space_fresh_gb" ||
            setting.name === "reserved_disk_space_existing_gb" ||
            setting.name === "player_session_retention_days"
          ) {
            this.form.setFieldValue(setting.name, parseInt(setting.value));
          }
        }
        this.form.setFieldValue(
          "game_server_plugin_runtime",
          this.gameServerPluginRuntime,
        );
        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  methods: {
    async updateSettings() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        const objects = [
          {
            name: "number_of_cpus_per_server",
            value: this.form.values.number_of_cpus_per_server?.toString(),
          },
          {
            name: "reserved_disk_space_fresh_gb",
            value: this.form.values.reserved_disk_space_fresh_gb?.toString(),
          },
          {
            name: "reserved_disk_space_existing_gb",
            value: this.form.values.reserved_disk_space_existing_gb?.toString(),
          },
          {
            name: "player_session_retention_days",
            value: String(
              this.clampRetention(
                this.form.values.player_session_retention_days,
              ),
            ),
          },
        ];

        if (!this.pluginRuntimeLocked) {
          objects.push({
            name: "public.game_server_plugin_runtime",
            value: this.form.values.game_server_plugin_runtime,
          });
        }

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
          title: this.$t("common.update"),
        });
      } finally {
        this.submitting = false;
      }
    },
    clampRetention(days: number | undefined) {
      const value = Math.trunc(Number(days));

      if (!Number.isFinite(value)) {
        return PLAYER_SESSION_RETENTION.fallback;
      }

      return Math.min(
        PLAYER_SESSION_RETENTION.max,
        Math.max(PLAYER_SESSION_RETENTION.min, value),
      );
    },
    async toggleCpuPinning() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "enable_cpu_pinning",
                  value: this.cpuPinningEnabled ? "false" : "true",
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
        title: this.$t("pages.settings.application.servers.update_cpu_pinning"),
      });
    },
    async cleanupRemovedNodes() {
      if (this.cleaningUpNodes) {
        return;
      }
      this.showCleanupNodesDialog = false;
      this.cleaningUpNodes = true;
      try {
        const { data } = await this.$apollo.mutate({
          mutation: gql`
            mutation CleanupRemovedNodes {
              cleanupRemovedNodes {
                nodes
                jobs
                volume_claims
                volumes
                failed
                node_delete_forbidden
                recently_ready
              }
            }
          `,
        });

        const {
          nodes,
          jobs,
          volume_claims,
          volumes,
          failed,
          node_delete_forbidden,
          recently_ready,
        } = data.cleanupRemovedNodes;
        const removed = nodes + jobs + volume_claims + volumes;

        const lines: string[] = [];
        if (removed > 0) {
          lines.push(
            this.$t("pages.settings.application.servers.cleanup_nodes_counts", {
              nodes,
              volumes,
              volume_claims,
              jobs,
            }),
          );
        }
        // Older panel installs do not let the API delete Kubernetes nodes.
        if (node_delete_forbidden) {
          lines.push(
            this.$t(
              "pages.settings.application.servers.cleanup_nodes_node_delete_forbidden",
            ),
          );
        }
        // They may only be restarting, so the API keeps them for now.
        if (recently_ready > 0) {
          lines.push(
            this.$t(
              "pages.settings.application.servers.cleanup_nodes_recently_ready",
              { recently_ready },
            ),
          );
        }
        if (failed > 0) {
          lines.push(
            this.$t(
              "pages.settings.application.servers.cleanup_nodes_failed_count",
              { failed },
            ),
          );
        }

        let title = this.$t(
          "pages.settings.application.servers.cleanup_nodes_done",
        );
        if (failed > 0) {
          title = this.$t(
            "pages.settings.application.servers.cleanup_nodes_done_with_errors",
          );
        } else if (
          removed === 0 &&
          !node_delete_forbidden &&
          recently_ready === 0
        ) {
          title = this.$t(
            "pages.settings.application.servers.cleanup_nodes_nothing",
          );
        }

        toast({
          title,
          description: lines.join("\n"),
          variant: failed > 0 ? "destructive" : "default",
        });
      } catch (error: any) {
        toast({
          title: this.$t(
            "pages.settings.application.servers.cleanup_nodes_failed",
          ),
          description: error?.message,
          variant: "destructive",
        });
      } finally {
        this.cleaningUpNodes = false;
      }
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
    cpuPinningEnabled() {
      return (
        this.settings.find((setting) => {
          return setting.name === "enable_cpu_pinning";
        })?.value === "true"
      );
    },
    gameServerPluginRuntime() {
      return useApplicationSettingsStore().gameServerPluginRuntime;
    },
    // SERVER_IMAGE pins a specific image, so the runtime is no longer ours to pick.
    pluginRuntimeLocked() {
      return (
        this.settings.find((setting) => {
          return setting.name === "game_server_plugin_runtime_locked";
        })?.value === "true"
      );
    },
  },
};
</script>
