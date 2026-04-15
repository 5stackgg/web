<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import Card from "~/components/ui/card/Card.vue";
definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <form @submit.prevent="updateSettings" class="grid gap-4">
      <Card variant="gradient">
        <div class="p-6 space-y-6">
          <div
            class="flex flex-row items-center justify-between cursor-pointer"
            @click="toggleCpuPinning"
          >
            <div class="space-y-0.5">
              <h4 class="text-base font-medium">
                {{
                  $t("pages.settings.application.servers.enable_cpu_pinning")
                }}
              </h4>
              <p class="text-sm text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.servers.enable_cpu_pinning_description",
                  )
                }}
              </p>
            </div>
            <Switch
              :model-value="cpuPinningEnabled"
              @update:model-value="toggleCpuPinning"
            />
          </div>

          <FormField
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
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

export default {
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            number_of_cpus_per_server: z.number().min(1).default(1),
            reserved_disk_space_fresh_gb: z.number().min(0).default(120),
            reserved_disk_space_existing_gb: z.number().min(0).default(60),
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
            setting.name === "reserved_disk_space_existing_gb"
          ) {
            this.form.setFieldValue(setting.name, parseInt(setting.value));
          }
        }
      },
    },
  },
  methods: {
    async updateSettings() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "number_of_cpus_per_server",
                  value: this.form.values.number_of_cpus_per_server?.toString(),
                },
                {
                  name: "reserved_disk_space_fresh_gb",
                  value:
                    this.form.values.reserved_disk_space_fresh_gb?.toString(),
                },
                {
                  name: "reserved_disk_space_existing_gb",
                  value:
                    this.form.values.reserved_disk_space_existing_gb?.toString(),
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
        title: this.$t("common.update"),
      });
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
  },
};
</script>
