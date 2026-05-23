<script setup lang="ts">
import {
  LucideDownload,
  LucideUpload,
  LucideHardDrive,
  LucideSparkles,
} from "lucide-vue-next";
import formatBytes from "~/utilities/formatBytes";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card } from "~/components/ui/card";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
    <PageTransition :delay="0">
      <Card
        v-if="match_map_demos_aggregate"
        variant="gradient"
        class="p-4 flex items-center gap-4 h-full"
      >
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
            {{
              formatBytes(
                (match_map_demos_aggregate.aggregate.sum.size || 0) +
                  (match_map_demos_aggregate.aggregate.sum.playback_size || 0),
              )
            }}~
          </p>
        </div>
      </Card>
    </PageTransition>

    <PageTransition :delay="50">
      <Card
        v-if="match_clips_aggregate"
        variant="gradient"
        class="p-4 flex items-center gap-4 h-full"
      >
        <div
          class="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10"
        >
          <LucideSparkles class="w-6 h-6 text-primary" />
        </div>
        <div class="flex-1">
          <h3 class="text-sm font-medium text-muted-foreground">
            {{
              $t("pages.settings.application.demo_settings.clips_used_storage")
            }}
          </h3>
          <p class="text-2xl font-bold mt-1">
            {{ formatBytes(match_clips_aggregate.aggregate.sum.size || 0) }}~
          </p>
        </div>
      </Card>
    </PageTransition>
  </div>

  <PageTransition :delay="100">
    <Card variant="gradient" class="mb-8 p-4 flex flex-col gap-2">
      <h3 class="text-lg font-semibold">
        {{ $t("pages.settings.application.demo_settings.test_s3_title") }}
      </h3>
      <div>
        <p class="text-sm text-muted-foreground">
          {{
            $t("pages.settings.application.demo_settings.test_s3_description")
          }}
        </p>
      </div>
      <div class="flex gap-4">
        <Button
          class="rounded-full px-6 py-2 font-medium shadow transition hover:bg-primary/90 flex items-center gap-2"
          @click="testUpload"
        >
          <LucideUpload class="w-4 h-4" />
          {{ $t("pages.settings.application.demo_settings.test_upload") }}
        </Button>
        <Button
          class="rounded-full px-6 py-2 font-medium shadow transition hover:bg-primary/90 flex items-center gap-2"
          @click="testDownload"
        >
          <LucideDownload class="w-4 h-4" />
          {{ $t("pages.settings.application.demo_settings.test_download") }}
        </Button>
      </div>
    </Card>
  </PageTransition>

  <PageTransition :delay="200">
    <form @submit.prevent="updateSettings" class="grid gap-6">
      <Card variant="gradient">
        <div class="p-6 space-y-6">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <LucideHardDrive class="w-5 h-5 text-primary" />
            {{ $t("pages.settings.application.demo_settings.demos_section") }}
          </h3>

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
        </div>
      </Card>

      <Card variant="gradient">
        <div class="p-6 space-y-6">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <LucideSparkles class="w-5 h-5 text-primary" />
            {{
              $t("pages.settings.application.demo_settings.highlights_section")
            }}
          </h3>

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

          <FormField
            v-slot="{ value, handleChange }"
            name="clip_bake_branding"
            type="checkbox"
            :value="true"
          >
            <FormItem>
              <div
                class="flex flex-row items-center justify-between cursor-pointer"
                @click="handleChange(!value)"
              >
                <div class="space-y-0.5">
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
                <FormControl>
                  <Switch
                    :model-value="value"
                    @update:model-value="handleChange"
                  />
                </FormControl>
              </div>
            </FormItem>
          </FormField>

          <FormField
            v-slot="{ value, handleChange }"
            name="auto_generate_match_clips"
            type="checkbox"
            :value="true"
          >
            <FormItem>
              <div
                class="flex flex-row items-center justify-between cursor-pointer"
                @click="handleChange(!value)"
              >
                <div class="space-y-0.5">
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
                <FormControl>
                  <Switch
                    :model-value="value"
                    @update:model-value="handleChange"
                  />
                </FormControl>
              </div>
            </FormItem>
          </FormField>

          <template v-if="form.values.auto_generate_match_clips">
            <div class="space-y-2">
              <p class="text-sm text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.demo_settings.clips_retention_storage_description",
                  )
                }}
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  v-slot="{ componentField }"
                  name="clips_min_retention"
                >
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
                      <span class="text-muted-foreground font-normal"
                        >(GB)</span
                      >
                    </FormLabel>
                    <Input type="number" v-bind="componentField"></Input>
                    <FormMessage />
                  </FormItem>
                </FormField>
              </div>
            </div>

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
          </template>
        </div>
      </Card>

      <div class="flex justify-start">
        <Button
          type="submit"
          :disabled="Object.keys(form.errors).length > 0"
          class="my-3"
        >
          {{ $t("common.update") }}
        </Button>
      </div>
    </form>
  </PageTransition>
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
            clips_min_retention: z.number().int().min(1).default(1),
            clips_max_storage: z.number().int().min(1).default(10),
            auto_generate_match_clips: z.boolean().default(false),
            auto_clip_default_visibility: z
              .enum(["private", "unlisted", "public"])
              .default("private"),
            default_hud_mode: z
              .enum(["horizontal", "vertical"])
              .default("horizontal"),
            clip_video_codec: z.enum(["h265", "h264"]).default("h265"),
            clip_fps: z.enum(["30", "60"]).default("60"),
            clip_resolution: z.enum(["720p", "1080p"]).default("1080p"),
            clip_bake_branding: z.boolean().default(true),
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
            setting.name === "demo_network_limiter" ||
            setting.name === "clips_min_retention" ||
            setting.name === "clips_max_storage"
          ) {
            if (!setting.value) {
              continue;
            }
            this.form.setFieldValue(setting.name, parseInt(setting.value));
            continue;
          }

          if (
            setting.name === "auto_generate_match_clips" ||
            setting.name === "clip_bake_branding"
          ) {
            this.form.setFieldValue(
              setting.name,
              setting.value === "true" || setting.value === true,
            );
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
                  name: "clips_min_retention",
                  value: this.form.values.clips_min_retention?.toString(),
                },
                {
                  name: "clips_max_storage",
                  value: this.form.values.clips_max_storage?.toString(),
                },
                {
                  name: "auto_generate_match_clips",
                  value: this.form.values.auto_generate_match_clips
                    ? "true"
                    : "false",
                },
                {
                  name: "auto_clip_default_visibility",
                  value:
                    this.form.values.auto_clip_default_visibility ?? "private",
                },
                {
                  name: "default_hud_mode",
                  value: this.form.values.default_hud_mode ?? "horizontal",
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
                {
                  name: "clip_bake_branding",
                  value: this.form.values.clip_bake_branding ? "true" : "false",
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
