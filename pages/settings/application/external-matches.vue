<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="external-matches"
          :title="$t('pages.settings.application.external_matches.section')"
        >
          <FormField
            v-slot="{ value, handleChange }"
            name="external_matches_enabled"
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
                      $t("pages.settings.application.external_matches.enabled")
                    }}
                  </h4>
                  <p class="text-sm text-muted-foreground">
                    {{
                      $t(
                        "pages.settings.application.external_matches.enabled_description",
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
            external_matches_enabled: z.boolean().default(true),
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
          if (setting.name === "public.external_matches_enabled") {
            this.form.setFieldValue(
              "external_matches_enabled",
              setting.value !== "false",
            );
          }
        }
        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  methods: {
    async updateSettings() {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "public.external_matches_enabled",
                  value: this.form.values.external_matches_enabled
                    ? "true"
                    : "false",
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
        title: this.$t("pages.settings.application.external_matches.updated"),
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
