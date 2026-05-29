<script setup lang="ts">
import {
  LucideDownload,
  LucideUpload,
  LucideHardDrive,
  LucideDatabase,
} from "lucide-vue-next";
import formatBytes from "~/utilities/formatBytes";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card } from "~/components/ui/card";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <SettingsPage>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
      <PageTransition :delay="0">
        <Card variant="gradient" class="p-4 flex items-center gap-4 h-full">
          <div
            class="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10"
          >
            <LucideDatabase class="w-6 h-6 text-primary" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-medium text-muted-foreground">
              {{ $t("pages.settings.application.demo_settings.total_storage") }}
            </h3>
            <p class="text-2xl font-bold mt-1">
              {{ formatBytes(totalStorageBytes) }}~
            </p>
          </div>
        </Card>
      </PageTransition>

      <PageTransition :delay="50">
        <Card variant="gradient" class="p-4 flex items-center gap-4 h-full">
          <div
            class="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10"
          >
            <LucideHardDrive class="w-6 h-6 text-primary" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-medium text-muted-foreground">
              {{ $t("pages.settings.application.demo_settings.used_storage") }}
            </h3>
            <p class="text-2xl font-bold mt-1">
              {{ formatBytes(demoStorageBytes) }}~
            </p>
          </div>
        </Card>
      </PageTransition>
    </div>

    <PageTransition :delay="200">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="demos"
          :title="$t('pages.settings.application.demo_settings.demos_section')"
        >
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
                    <span class="text-muted-foreground font-normal"
                      >(days)</span
                    >
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
                    <span class="text-muted-foreground font-normal">(GB)</span>
                  </FormLabel>
                  <Input type="number" v-bind="componentField"></Input>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>
          </div>

          <FormField v-slot="{ componentField }" name="cloudflare_worker_url">
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.demo_settings.cloudflare_worker_url",
                )
              }}</FormLabel>
              <FormDescription>
                {{
                  $t(
                    "pages.settings.application.demo_settings.cloudflare_worker_url_description",
                  )
                }}
                <a
                  href="https://docs.5stack.gg/advanced/s3/backblaze#backblaze-cloudflare"
                  target="_blank"
                  class="text-primary hover:underline"
                >
                  docs.5stack.gg/advanced/s3/backblaze
                </a>
              </FormDescription>
              <Input v-bind="componentField"></Input>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="space-y-2">
            <p class="text-sm text-muted-foreground">
              {{
                $t(
                  "pages.settings.application.demo_settings.test_s3_description",
                )
              }}
            </p>
            <div class="flex gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                class="flex items-center gap-2"
                @click="testUpload"
              >
                <LucideUpload class="w-4 h-4" />
                {{ $t("pages.settings.application.demo_settings.test_upload") }}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                class="flex items-center gap-2"
                @click="testDownload"
              >
                <LucideDownload class="w-4 h-4" />
                {{
                  $t("pages.settings.application.demo_settings.test_download")
                }}
              </Button>
            </div>
          </div>
        </SettingsSection>

        <div class="flex justify-start">
          <Button
            type="submit"
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
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

export default {
  apollo: {
    match_map_demos_aggregate: {
      query: generateQuery({
        match_map_demos_aggregate: [
          {},
          {
            aggregate: {
              sum: {
                size: true,
                playback_size: true,
              },
            },
          },
        ],
      }),
    },
    match_clips_aggregate: {
      query: generateQuery({
        match_clips_aggregate: [
          {},
          {
            aggregate: {
              sum: {
                size: true,
              },
            },
          },
        ],
      }),
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            s3_min_retention: z.number().int().min(1).optional().default(1),
            s3_max_storage: z.number().int().min(1).default(10),
            cloudflare_worker_url: z.string().url().optional(),
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
    async testUpload() {
      const {
        data: {
          testUpload: { error },
        },
      } = await (this.$apollo as any).mutate({
        mutation: generateMutation({
          testUpload: {
            error: true,
          },
        }),
      });

      if (!error) {
        toast({
          title: this.$t(
            "pages.settings.application.demo_settings.test_upload_success",
          ),
        });
        return;
      }

      toast({
        title: `${this.$t("pages.settings.application.demo_settings.test_upload_failed")} ${error}`,
        variant: "destructive",
      });
    },
    async testDownload() {
      const {
        data: {
          getTestUploadLink: { link, error },
        },
      } = await (this.$apollo as any).mutate({
        mutation: generateMutation({
          getTestUploadLink: {
            link: true,
            error: true,
          },
        }),
      });

      if (error) {
        toast({
          title: `${this.$t("pages.settings.application.demo_settings.test_download_failed")} ${error}`,
          variant: "destructive",
        });
        return;
      }

      window.open(link, "_blank");
    },
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
                  name: "cloudflare_worker_url",
                  value: this.form.values.cloudflare_worker_url,
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
    demoStorageBytes() {
      // Aggregate sums come back as bigint strings; coerce so "+" adds
      // instead of concatenating.
      const sum = (this as any).match_map_demos_aggregate?.aggregate?.sum;
      return Number(sum?.size || 0) + Number(sum?.playback_size || 0);
    },
    clipStorageBytes() {
      return Number(
        (this as any).match_clips_aggregate?.aggregate?.sum?.size || 0,
      );
    },
    totalStorageBytes() {
      return (this as any).demoStorageBytes + (this as any).clipStorageBytes;
    },
  },
};
</script>
