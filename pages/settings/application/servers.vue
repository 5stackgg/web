<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
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

        <SettingsSaveBar
          :form="form"
          :submitting="submitting"
          @save="updateSettings"
        />
      </form>
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

export default {
  data() {
    return {
      submitting: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            game_server_plugin_runtime: z.string().default("swiftlys2"),
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
