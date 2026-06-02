<script setup lang="ts">
import { LucideSparkles, LucideDatabase } from "lucide-vue-next";
import formatBytes from "~/utilities/formatBytes";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card } from "~/components/ui/card";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
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
            <LucideSparkles class="w-6 h-6 text-primary" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-medium text-muted-foreground">
              {{
                $t(
                  "pages.settings.application.demo_settings.clips_used_storage",
                )
              }}
            </h3>
            <p class="text-2xl font-bold mt-1">
              {{ formatBytes(clipStorageBytes) }}~
            </p>
          </div>
        </Card>
      </PageTransition>
    </div>

    <PageTransition :delay="100">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="highlights"
          :title="
            $t('pages.settings.application.demo_settings.highlights_section')
          "
        >
          <!-- Toggles persist immediately on change — no Update needed. -->
          <div
            class="rounded-lg border border-border/60 divide-y divide-border/60 px-4"
          >
            <div
              class="flex flex-row items-center justify-between cursor-pointer py-4"
              @click="
                toggleBooleanSetting(
                  'auto_generate_match_clips',
                  autoGenerateMatchClips,
                )
              "
            >
              <div class="space-y-0.5 pr-4">
                <h4 class="text-base font-medium">
                  {{
                    $t(
                      "pages.settings.application.demo_settings.auto_generate_match_clips",
                    )
                  }}
                </h4>
                <p class="text-sm text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.demo_settings.auto_generate_match_clips_description",
                    )
                  }}
                </p>
              </div>
              <Switch
                :model-value="autoGenerateMatchClips"
                @update:model-value="
                  toggleBooleanSetting(
                    'auto_generate_match_clips',
                    autoGenerateMatchClips,
                  )
                "
                @click.stop
              />
            </div>

            <div
              v-if="autoGenerateMatchClips"
              class="flex flex-row items-center justify-between cursor-pointer py-4 ml-4 pl-4 border-l-2 border-border/60"
              @click="
                toggleBooleanSetting(
                  'auto_generate_match_clips_imported',
                  autoGenerateMatchClipsImported,
                )
              "
            >
              <div class="space-y-0.5 pr-4">
                <h4 class="text-base font-medium">
                  {{
                    $t(
                      "pages.settings.application.demo_settings.auto_generate_match_clips_imported",
                    )
                  }}
                </h4>
                <p class="text-sm text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.demo_settings.auto_generate_match_clips_imported_description",
                    )
                  }}
                </p>
              </div>
              <Switch
                :model-value="autoGenerateMatchClipsImported"
                @update:model-value="
                  toggleBooleanSetting(
                    'auto_generate_match_clips_imported',
                    autoGenerateMatchClipsImported,
                  )
                "
                @click.stop
              />
            </div>

            <div
              class="flex flex-row items-center justify-between cursor-pointer py-4"
              @click="
                toggleBooleanSetting(
                  'pause_renders_during_active_match',
                  pauseRendersDuringActiveMatch,
                )
              "
            >
              <div class="space-y-0.5 pr-4">
                <h4 class="text-base font-medium">
                  {{
                    $t(
                      "pages.settings.application.demo_settings.pause_renders_during_active_match",
                    )
                  }}
                </h4>
                <p class="text-sm text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.demo_settings.pause_renders_during_active_match_description",
                    )
                  }}
                </p>
              </div>
              <Switch
                :model-value="pauseRendersDuringActiveMatch"
                @update:model-value="
                  toggleBooleanSetting(
                    'pause_renders_during_active_match',
                    pauseRendersDuringActiveMatch,
                  )
                "
                @click.stop
              />
            </div>

            <div
              class="flex flex-row items-center justify-between cursor-pointer py-4"
              @click="
                toggleBooleanSetting('clip_bake_branding', clipBakeBranding)
              "
            >
              <div class="space-y-0.5 pr-4">
                <h4 class="text-base font-medium">
                  {{
                    $t(
                      "pages.settings.application.demo_settings.clip_bake_branding",
                    )
                  }}
                </h4>
                <p class="text-sm text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.demo_settings.clip_bake_branding_description",
                    )
                  }}
                </p>
              </div>
              <Switch
                :model-value="clipBakeBranding"
                @update:model-value="
                  toggleBooleanSetting('clip_bake_branding', clipBakeBranding)
                "
                @click.stop
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          id="render-output"
          :title="
            $t('pages.settings.application.demo_settings.render_output_section')
          "
        >
          <FormField v-slot="{ componentField }" name="clip_video_codec">
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.demo_settings.clip_video_codec")
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.demo_settings.clip_video_codec_description",
                )
              }}</FormDescription>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="h265">
                    {{
                      $t("pages.settings.application.demo_settings.codec_h265")
                    }}
                  </SelectItem>
                  <SelectItem value="h264">
                    {{
                      $t("pages.settings.application.demo_settings.codec_h264")
                    }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="clip_fps">
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.demo_settings.clip_fps")
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.demo_settings.clip_fps_description",
                )
              }}</FormDescription>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="60">60 FPS</SelectItem>
                  <SelectItem value="30">30 FPS</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="clip_resolution">
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.demo_settings.clip_resolution")
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.demo_settings.clip_resolution_description",
                )
              }}</FormDescription>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          v-if="autoGenerateMatchClips"
          id="storage"
          :title="
            $t('pages.settings.application.demo_settings.clip_storage_section')
          "
        >
          <FormField
            v-slot="{ value, handleChange }"
            name="auto_clip_default_visibility"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.demo_settings.auto_clip_default_visibility",
                )
              }}</FormLabel>
              <Select :model-value="value" @update:model-value="handleChange">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      :placeholder="
                        $t(
                          'pages.settings.application.demo_settings.visibility_private',
                        )
                      "
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="private">{{
                    $t(
                      "pages.settings.application.demo_settings.visibility_private",
                    )
                  }}</SelectItem>
                  <SelectItem value="unlisted">{{
                    $t(
                      "pages.settings.application.demo_settings.visibility_unlisted",
                    )
                  }}</SelectItem>
                  <SelectItem value="public">{{
                    $t(
                      "pages.settings.application.demo_settings.visibility_public",
                    )
                  }}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="space-y-2">
            <p class="text-sm text-muted-foreground">
              {{
                $t(
                  "pages.settings.application.demo_settings.clips_retention_storage_description",
                )
              }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField v-slot="{ componentField }" name="clips_min_retention">
                <FormItem>
                  <FormLabel>
                    {{
                      $t(
                        "pages.settings.application.demo_settings.clips_min_retention",
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

              <FormField v-slot="{ componentField }" name="clips_max_storage">
                <FormItem>
                  <FormLabel>
                    {{
                      $t(
                        "pages.settings.application.demo_settings.clips_max_storage",
                      )
                    }}
                    <span class="text-muted-foreground font-normal">(GB)</span>
                  </FormLabel>
                  <Input type="number" v-bind="componentField"></Input>
                  <FormMessage />
                </FormItem>
              </FormField>
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
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            clips_min_retention: z.number().int().min(1).default(1),
            clips_max_storage: z.number().int().min(1).default(10),
            auto_clip_default_visibility: z
              .enum(["private", "unlisted", "public"])
              .default("private"),
            clip_video_codec: z.enum(["h265", "h264"]).default("h265"),
            clip_fps: z.enum(["30", "60"]).default("60"),
            clip_resolution: z.enum(["720p", "1080p"]).default("1080p"),
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
            setting.name === "clips_min_retention" ||
            setting.name === "clips_max_storage"
          ) {
            if (!setting.value) {
              continue;
            }
            this.form.setFieldValue(setting.name, parseInt(setting.value));
            continue;
          }

          if (setting.name === "clip_video_codec") {
            this.form.setFieldValue(
              setting.name,
              setting.value === "h264" ? "h264" : "h265",
            );
            continue;
          }

          if (setting.name === "clip_fps") {
            this.form.setFieldValue(
              setting.name,
              setting.value === "30" ? "30" : "60",
            );
            continue;
          }

          if (setting.name === "clip_resolution") {
            this.form.setFieldValue(
              setting.name,
              setting.value === "720p" ? "720p" : "1080p",
            );
            continue;
          }

          if (setting.name === "auto_clip_default_visibility") {
            this.form.setFieldValue(setting.name, setting.value ?? "private");
            continue;
          }
        }
        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  methods: {
    // Read a boolean setting straight from the store, with a default for when
    // the row doesn't exist yet.
    booleanSetting(name: string, fallback: boolean) {
      const setting = (
        this.settings as Array<{ name: string; value: any }>
      ).find((s) => s.name === name);
      if (!setting || setting.value == null) return fallback;
      return setting.value === "true" || setting.value === true;
    },
    // Persist a toggle immediately — no Update button. Writes the inverse of
    // the value shown so a double-fire stays idempotent.
    async toggleBooleanSetting(name: string, current: boolean) {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: { name, value: current ? "false" : "true" },
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            { __typename: true },
          ],
        }),
      });

      toast({
        title: this.$t("pages.settings.application.highlights.updated"),
      });
    },
    async updateSettings() {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "clips_min_retention",
                  value: this.form.values.clips_min_retention?.toString(),
                },
                {
                  name: "clips_max_storage",
                  value: this.form.values.clips_max_storage?.toString(),
                },
                {
                  name: "auto_clip_default_visibility",
                  value:
                    this.form.values.auto_clip_default_visibility ?? "private",
                },
                {
                  name: "clip_video_codec",
                  value: this.form.values.clip_video_codec ?? "h265",
                },
                {
                  name: "clip_fps",
                  value: this.form.values.clip_fps ?? "60",
                },
                {
                  name: "clip_resolution",
                  value: this.form.values.clip_resolution ?? "1080p",
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
        title: this.$t("pages.settings.application.highlights.updated"),
      });
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
    autoGenerateMatchClips(): boolean {
      return this.booleanSetting("auto_generate_match_clips", false);
    },
    autoGenerateMatchClipsImported(): boolean {
      return this.booleanSetting("auto_generate_match_clips_imported", false);
    },
    pauseRendersDuringActiveMatch(): boolean {
      return this.booleanSetting("pause_renders_during_active_match", false);
    },
    clipBakeBranding(): boolean {
      return this.booleanSetting("clip_bake_branding", true);
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
