<script setup lang="ts">
import { LucideDownload, LucideUpload } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import OrphanedUploadsButton from "~/components/settings/OrphanedUploadsButton.vue";
import ReparseAllDemosButton from "~/components/settings/ReparseAllDemosButton.vue";
import StorageBreakdown from "~/components/settings/StorageBreakdown.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
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
          <!-- The HUD moved out of this page. It used to be a two-value
               layout setting, which fit here beside the other playback
               toggles; it is a library of importable bundles now, with an
               upload and a preview, so it has a page of its own. -->
          <p class="text-sm text-muted-foreground">
            {{ $t("pages.settings.application.demo_settings.hud_moved") }}
            <NuxtLink
              to="/settings/application/broadcast-huds"
              class="underline underline-offset-4 hover:text-foreground"
            >
              {{ $t("pages.settings.application.broadcast_huds.title") }}
            </NuxtLink>
          </p>
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
            cloudflare_worker_url: z.string().url().optional(),
            demo_network_limiter: z.number().int().optional().nullable(),
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

          // default_hud_mode is deliberately not loaded or written here any
          // more. The HUD library owns it, and the api still reads the old row
          // as its fallback -- so this page must not keep rewriting it, or an
          // instance that has chosen a HUD would have that choice quietly
          // reasserted every time these settings are saved.
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
