<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <form @submit.prevent="updateSettings" class="grid gap-4">
    <div
      class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
      @click="toggleSteamRelay"
    >
      <div class="space-y-0.5">
        <h4 class="text-base font-medium">
          {{ $t("pages.settings.application.servers.steam_relay") }}
        </h4>
        <p class="text-sm text-muted-foreground">
          {{ $t("pages.settings.application.servers.steam_relay_description") }}
        </p>
      </div>
      <Switch
        :model-value="steamRelayEnabled"
        @update:model-value="toggleSteamRelay"
      />
    </div>

    <div
      class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
      @click="toggleCpuPinning"
    >
      <div class="space-y-0.5">
        <h4 class="text-base font-medium">
          {{ $t("pages.settings.application.servers.enable_cpu_pinning") }}
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

    <FormField v-slot="{ componentField }" name="number_of_cpus_per_server">
      <FormItem>
        <FormLabel>{{
          $t("pages.settings.application.servers.number_of_cpus_per_server")
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

    <div class="flex justify-start">
      <Button
        type="submit"
        :disabled="Object.keys(form.errors).length > 0"
        class="my-3"
      >
        {{ $t("pages.settings.application.servers.update") }}
      </Button>
    </div>
  </form>
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
            number_of_cpus_per_server: z.number().min(1).default(2),
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
          if (setting.name === "number_of_cpus_per_server") {
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
        title: this.$t("pages.settings.application.servers.update"),
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
    async toggleSteamRelay() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "enable_steam_relay",
                  value: this.steamRelayEnabled ? "false" : "true",
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
        title: this.$t("pages.settings.application.servers.update_steam_relay"),
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
    steamRelayEnabled() {
      return (
        this.settings.find((setting) => {
          return setting.name === "enable_steam_relay";
        })?.value === "true"
      );
    },
  },
};
</script>
