<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import OrphanedUploadsButton from "~/components/settings/OrphanedUploadsButton.vue";
import StorageBreakdown from "~/components/settings/StorageBreakdown.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <StorageBreakdown>
        <template #action>
          <OrphanedUploadsButton />
        </template>
      </StorageBreakdown>
    </PageTransition>

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

          <div v-if="autoGenerateMatchClips" class="space-y-4">
            <h4
              class="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {{
                $t(
                  "pages.settings.application.demo_settings.auto_clip_filters_section",
                )
              }}
            </h4>

            <!-- These save on change too — no Update needed. -->
            <div
              class="rounded-lg border border-border/60 divide-y divide-border/60 px-4"
            >
              <div
                class="flex flex-row items-center justify-between gap-4 py-4"
              >
                <div class="space-y-0.5 pr-4">
                  <h4 class="text-base font-medium">
                    {{
                      $t(
                        "pages.settings.application.demo_settings.auto_clip_min_kills",
                      )
                    }}
                  </h4>
                  <p class="text-sm text-muted-foreground">
                    {{
                      $t(
                        "pages.settings.application.demo_settings.auto_clip_min_kills_description",
                      )
                    }}
                  </p>
                </div>
                <Select
                  :model-value="autoClipMinKills"
                  @update:model-value="
                    (value) => setStringSetting('auto_clip_min_kills', value)
                  "
                >
                  <SelectTrigger class="w-[220px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{{
                      $t(
                        "pages.settings.application.demo_settings.auto_clip_min_kills_any",
                      )
                    }}</SelectItem>
                    <SelectItem value="2">{{
                      $t(
                        "pages.settings.application.demo_settings.auto_clip_min_kills_2k",
                      )
                    }}</SelectItem>
                    <SelectItem value="3">{{
                      $t(
                        "pages.settings.application.demo_settings.auto_clip_min_kills_3k",
                      )
                    }}</SelectItem>
                    <SelectItem value="4">{{
                      $t(
                        "pages.settings.application.demo_settings.auto_clip_min_kills_4k",
                      )
                    }}</SelectItem>
                    <SelectItem value="5">{{
                      $t(
                        "pages.settings.application.demo_settings.auto_clip_min_kills_ace",
                      )
                    }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div
                class="flex flex-row items-center justify-between cursor-pointer py-4"
                @click="
                  toggleBooleanSetting(
                    'auto_clip_always_include_knife',
                    autoClipAlwaysIncludeKnife,
                  )
                "
              >
                <div class="space-y-0.5 pr-4">
                  <h4 class="text-base font-medium">
                    {{
                      $t(
                        "pages.settings.application.demo_settings.auto_clip_always_include_knife",
                      )
                    }}
                  </h4>
                  <p class="text-sm text-muted-foreground">
                    {{
                      $t(
                        "pages.settings.application.demo_settings.auto_clip_always_include_knife_description",
                      )
                    }}
                  </p>
                </div>
                <Switch
                  :model-value="autoClipAlwaysIncludeKnife"
                  @update:model-value="
                    toggleBooleanSetting(
                      'auto_clip_always_include_knife',
                      autoClipAlwaysIncludeKnife,
                    )
                  "
                  @click.stop
                />
              </div>
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
                    <span class="text-muted-foreground font-normal">{{
                      $t("pages.settings.application.demo_settings.unit_days")
                    }}</span>
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
            clips_min_retention: z.number().int().min(1).default(1),
            clips_max_storage: z.number().int().min(1).default(10),
            auto_clip_default_visibility: z
              .enum(["private", "public"])
              .default("private"),
            clip_video_codec: z.enum(["h265", "h264"]).default("h264"),
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
              setting.value === "h265" ? "h265" : "h264",
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
    // Persist a string-valued setting immediately on change — no Update button.
    async setStringSetting(name: string, value: string) {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: { name, value },
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
                  value: this.form.values.clip_video_codec ?? "h264",
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
    autoClipAlwaysIncludeKnife(): boolean {
      return this.booleanSetting("auto_clip_always_include_knife", false);
    },
    autoClipMinKills(): string {
      const setting = (
        this.settings as Array<{ name: string; value: any }>
      ).find((s) => s.name === "auto_clip_min_kills");
      const value = setting?.value != null ? String(setting.value) : "1";
      return ["1", "2", "3", "4", "5"].includes(value) ? value : "1";
    },
  },
};
</script>
