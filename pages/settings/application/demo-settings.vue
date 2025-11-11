<script setup lang="ts">
import { LucideDownload, LucideUpload, LucideHardDrive } from "lucide-vue-next";
import formatBits from "~/utilities/formatBits";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <div
    v-if="match_map_demos_aggregate"
    class="mb-8 p-4 bg-muted rounded-lg flex items-center gap-4"
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
        {{ formatBits(match_map_demos_aggregate.aggregate.sum.size) }}~
      </p>
    </div>
  </div>

  <div class="mb-8 p-4 bg-muted rounded-lg flex flex-col gap-2">
    <h3 class="text-lg font-semibold">
      {{ $t("pages.settings.application.demo_settings.test_s3_title") }}
    </h3>
    <div>
      <p class="text-sm text-muted-foreground">
        {{ $t("pages.settings.application.demo_settings.test_s3_description") }}
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
  </div>

  <form @submit.prevent="updateSettings" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="demo_network_limiter">
      <FormItem>
        <FormLabel>{{
          $t("pages.settings.application.demo_settings.demo_network_limiter")
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

    <FormField v-slot="{ componentField }" name="s3_min_retention">
      <FormItem>
        <FormLabel>{{
          $t("pages.settings.application.demo_settings.min_retention")
        }}</FormLabel>
        <FormDescription>{{
          $t(
            "pages.settings.application.demo_settings.min_retention_description",
          )
        }}</FormDescription>
        <Input type="number" v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="s3_max_storage">
      <FormItem>
        <FormLabel>{{
          $t("pages.settings.application.demo_settings.max_storage")
        }}</FormLabel>
        <FormDescription>{{
          $t("pages.settings.application.demo_settings.max_storage_description")
        }}</FormDescription>
        <Input type="number" v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="cloudflare_worker_url">
      <FormItem>
        <FormLabel>{{
          $t("pages.settings.application.demo_settings.cloudflare_worker_url")
        }}</FormLabel>
        <FormDescription>
          {{
            $t(
              "pages.settings.application.demo_settings.cloudflare_worker_url_description",
            )
          }}
          <a
            href="https://docs.5stack.gg/s3/backblaze"
            target="_blank"
            class="text-primary hover:underline"
          >
            https://docs.5stack.gg/s3/backblaze
          </a>
        </FormDescription>
        <Input v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="flex justify-start">
      <Button
        type="submit"
        :disabled="Object.keys(form.errors).length > 0"
        class="my-3"
      >
        {{ $t("pages.settings.application.demo_settings.update") }}
      </Button>
    </div>
  </form>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
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
