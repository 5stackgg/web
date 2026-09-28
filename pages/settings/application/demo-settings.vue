<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import OrphanedUploadsButton from "~/components/settings/OrphanedUploadsButton.vue";
import ReparseAllDemosButton from "~/components/settings/ReparseAllDemosButton.vue";
import StorageBreakdown from "~/components/settings/StorageBreakdown.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import BackblazeWorkerStatus from "~/components/settings/BackblazeWorkerStatus.vue";
import StorageCheck from "~/components/settings/StorageCheck.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <StorageBreakdown>
        <template #action>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <ReparseAllDemosButton />
            <OrphanedUploadsButton />
          </div>
        </template>
      </StorageBreakdown>
    </PageTransition>

    <PageTransition :delay="200">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="playback"
          :title="
            $t('pages.settings.application.demo_settings.playback_section')
          "
        >
          <!-- Default HUD bundle the game-streamer pod loads at boot.
               Used for live, demo playback, and batch-highlights pods.
               Streamers can still hot-swap mid-stream from the live /
               demo player UI; this is just the persistent default. -->
          <FormField v-slot="{ value, handleChange }" name="default_hud_mode">
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.demo_settings.default_hud_mode")
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.demo_settings.default_hud_mode_description",
                )
              }}</FormDescription>
              <Select :model-value="value" @update:model-value="handleChange">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="horizontal">
                    {{
                      $t(
                        "pages.settings.application.demo_settings.hud_mode_horizontal",
                      )
                    }}
                  </SelectItem>
                  <SelectItem value="vertical">
                    {{
                      $t(
                        "pages.settings.application.demo_settings.hud_mode_vertical",
                      )
                    }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="storage"
          :title="
            $t('pages.settings.application.demo_settings.storage_section')
          "
        >
          <div class="space-y-2">
            <p class="text-sm text-muted-foreground">
              {{
                $t(
                  "pages.settings.application.demo_settings.retention_storage_description",
                )
              }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField v-slot="{ componentField }" name="s3_min_retention">
                <FormItem>
                  <FormLabel>
                    {{
                      $t(
                        "pages.settings.application.demo_settings.min_retention",
                      )
                    }}
                    <span class="text-muted-foreground font-normal">{{
                      $t("pages.settings.application.demo_settings.unit_days")
                    }}</span>
                  </FormLabel>
                  <Input type="number" v-bind="componentField"></Input>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="s3_max_storage">
                <FormItem>
                  <FormLabel>
                    {{
                      $t("pages.settings.application.demo_settings.max_storage")
                    }}
                    <span class="text-muted-foreground font-normal">{{
                      $t("pages.settings.application.demo_settings.unit_gb")
                    }}</span>
                  </FormLabel>
                  <Input type="number" v-bind="componentField"></Input>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>
          </div>

          <FormField v-slot="{ componentField }" name="demo_network_limiter">
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.demo_settings.demo_network_limiter",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.demo_settings.demo_network_limiter_description",
                )
              }}</FormDescription>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      :placeholder="$t('demo_network_limiter.network_limit')"
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem :value="null">
                      {{ $t("demo_network_limiter.unlimited") }}
                    </SelectItem>
                    <SelectItem :value="0">0 Mbps</SelectItem>
                    <SelectItem :value="1">1 Mbps</SelectItem>
                    <SelectItem :value="2">2 Mbps</SelectItem>
                    <SelectItem :value="5">5 Mbps</SelectItem>
                    <SelectItem :value="10">10 Mbps</SelectItem>
                    <SelectItem :value="20">20 Mbps</SelectItem>
                    <SelectItem :value="50">50 Mbps</SelectItem>
                    <SelectItem :value="100">100 Mbps</SelectItem>
                    <SelectItem :value="200">200 Mbps</SelectItem>
                    <SelectItem :value="500">500 Mbps</SelectItem>
                    <SelectItem :value="1000">1000 Mbps</SelectItem>
                    <SelectItem :value="2000">2000 Mbps</SelectItem>
                    <SelectItem :value="5000">5000 Mbps</SelectItem>
                    <SelectItem :value="10000">10000 Mbps</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="cloudflare"
          :title="
            $t(
              'pages.settings.application.demo_settings.cloudflare_worker_section',
            )
          "
          :description="
            $t(
              'pages.settings.application.demo_settings.cloudflare_worker_description',
            )
          "
        >
          <BackblazeWorkerStatus />
        </SettingsSection>

        <SettingsSection
          id="storage-check"
          :title="
            $t(
              'pages.settings.application.demo_settings.storage_check_section',
            )
          "
          :description="
            $t(
              'pages.settings.application.demo_settings.storage_check_description',
            )
          "
        >
          <StorageCheck />
        </SettingsSection>

        <SettingsSaveBar :form="form" @save="updateSettings" />
      </form>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            s3_min_retention: z.number().int().min(1).optional().default(1),
            s3_max_storage: z.number().int().min(1).default(10),
            demo_network_limiter: z.number().int().optional().nullable(),
            default_hud_mode: z
              .enum(["horizontal", "vertical"])
              .default("horizontal"),
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
            setting.name === "s3_min_retention" ||
            setting.name === "s3_max_storage" ||
            setting.name === "demo_network_limiter"
          ) {
            if (!setting.value) {
              continue;
            }
            this.form.setFieldValue(setting.name, parseInt(setting.value));
            continue;
          }

          if (setting.name === "default_hud_mode") {
            // Persisted value may be an old typo, stale enum, or the
            // legacy "default" (now folded into "horizontal" since the
            // two render identically) — coerce so the Select doesn't
            // render an unknown option.
            const value =
              setting.value === "vertical" ? "vertical" : "horizontal";
            this.form.setFieldValue(setting.name, value);
            continue;
          }

          this.form.setFieldValue(setting.name, setting.value);
        }
        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  methods: {
    async updateSettings() {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "s3_min_retention",
                  value: this.form.values.s3_min_retention?.toString(),
                },
                {
                  name: "s3_max_storage",
                  value: this.form.values.s3_max_storage?.toString(),
                },
                {
                  name: "demo_network_limiter",
                  value: this.form.values.demo_network_limiter?.toString(),
                },
                {
                  name: "default_hud_mode",
                  value: this.form.values.default_hud_mode ?? "horizontal",
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
        title: this.$t(
          "pages.settings.application.demo_settings.updated_s3_settings",
        ),
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
