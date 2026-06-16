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
      <form @submit.prevent="updateTelemetrySettings" class="space-y-6">
        <SettingsSection
          id="telemetry"
          :title="$t('pages.settings.application.telemetry.title')"
          :description="
            $t('pages.settings.application.telemetry.telemetry_description')
          "
          clickable-header
          @header-click="toggleTelemetry"
        >
          <template #action>
            <Switch
              :model-value="telemetryEnabled"
              @update:model-value="toggleTelemetry"
            />
          </template>
        </SettingsSection>

        <SettingsSection
          id="analytics"
          :title="$t('pages.settings.application.telemetry.analytics_section')"
          :description="
            $t(
              'pages.settings.application.telemetry.analytics_section_description',
            )
          "
        >
          <FormField
            v-slot="{ componentField }"
            name="public.google_tagmanager_code"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.telemetry.google_tag_manager_code",
                )
              }}</FormLabel>
              <Input v-bind="componentField" placeholder="GTM-XXXXXXX" />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSaveBar
          :form="form"
          :submitting="submitting"
          @save="updateTelemetrySettings"
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
            public: z.object({
              google_tagmanager_code: z.string().optional(),
            }),
          }),
        ),
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler() {
        this.form.resetForm({
          values: {
            public: {
              google_tagmanager_code: this.settings.find(
                (setting) => setting.name === "public.google_tagmanager_code",
              )?.value,
            },
          },
        });
      },
    },
  },
  methods: {
    async toggleTelemetry() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "telemetry",
                  value: this.telemetryEnabled ? "false" : "true",
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
        title: this.$t("pages.settings.application.telemetry.update_success"),
      });
    },
    async updateTelemetrySettings() {
      if (this.submitting) {
        return;
      }
      const { valid } = await this.form.validate();
      if (!valid) {
        return;
      }
      this.submitting = true;
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: [
                  {
                    name: "public.google_tagmanager_code",
                    value: this.form.values.public?.google_tagmanager_code,
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
          title: this.$t("pages.settings.application.telemetry.update_success"),
        });
      } finally {
        this.submitting = false;
      }
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
    telemetryEnabled() {
      return (
        this.settings.find((setting) => {
          return setting.name === "telemetry";
        })?.value !== "false"
      );
    },
  },
};
</script>
