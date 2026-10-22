<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";

const { locales } = useI18n();
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <form class="space-y-6" @submit.prevent="updateSettings">
        <SettingsSection
          id="language"
          :title="$t('pages.settings.application.language.title')"
          :description="$t('pages.settings.application.language.description')"
        >
          <FormField v-slot="{ componentField }" name="public.default_language">
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.language.default_language")
              }}</FormLabel>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      v-for="locale in locales"
                      :key="locale.code"
                      :value="locale.code"
                    >
                      <span class="flex items-center gap-2">
                        <span>{{ locale.flag }}</span>
                        <span>{{ locale.name }}</span>
                      </span>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
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
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      submitting: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            public: z.object({
              default_language: z.string().default("en"),
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
              default_language: useApplicationSettingsStore().defaultLanguage,
            },
          },
        });
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
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings_one: [
              {
                object: {
                  name: "public.default_language",
                  value: (this.form.values as any).public.default_language,
                },
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
          title: this.$t("pages.settings.application.update_success") as string,
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
  },
};
</script>
