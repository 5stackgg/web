<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import Card from "~/components/ui/card/Card.vue";
definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <form @submit.prevent="updateTelemetrySettings" class="grid gap-4">
      <Card variant="gradient">
        <div class="p-6 space-y-6">
          <div class="flex flex-row items-center justify-between cursor-pointer" @click="toggleTelemetry">
            <div class="space-y-0.5">
              <h4 class="text-base font-medium">
                {{ $t("pages.settings.application.telemetry.telemetry") }}
              </h4>
              <p class="text-sm text-muted-foreground">
                {{
                  $t("pages.settings.application.telemetry.telemetry_description")
                }}
              </p>
            </div>
            <Switch
              :model-value="telemetryEnabled"
              @update:model-value="toggleTelemetry"
            />
          </div>

          <FormField
            v-slot="{ componentField }"
            name="public.google_tagmanager_code"
          >
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.telemetry.google_tag_manager_code")
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.telemetry.google_tag_manager_code_description",
                )
              }}</FormDescription>
              <Input v-bind="componentField" />
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
          {{ $t("pages.settings.application.telemetry.update") }}
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
        this.form.setValues({
          public: {
            google_tagmanager_code: this.settings.find(
              (setting) => setting.name === "public.google_tagmanager_code",
            )?.value,
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
      const { valid } = await this.form.validate();
      if (!valid) {
        return;
      }
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