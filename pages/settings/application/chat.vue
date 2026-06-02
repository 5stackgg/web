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
          id="chat"
          :title="$t('pages.settings.application.chat.title')"
          :description="$t('pages.settings.application.chat.description')"
        >
          <FormField v-slot="{ componentField }" name="public.chat_message_ttl">
            <FormItem>
              <FormLabel>
                {{ $t("pages.settings.application.chat.chat_message_ttl") }}
              </FormLabel>
              <FormDescription>
                {{
                  $t(
                    "pages.settings.application.chat.chat_message_ttl_description",
                  )
                }}
              </FormDescription>
              <FormControl>
                <Input v-bind="componentField" type="number" min="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <div class="flex justify-start">
          <Button
            type="submit"
            :loading="submitting"
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
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

export default {
  data() {
    return {
      submitting: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            public: z.object({
              chat_message_ttl: z.number().int().min(0).default(3600),
            }),
          }),
        ),
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal: Array<{ name: string; value: string | null }>) {
        for (const setting of newVal) {
          if (setting.name === "public.chat_message_ttl") {
            const parsed = Number(setting.value);
            if (!Number.isNaN(parsed)) {
              (this.form.setFieldValue as any)(setting.name, parsed);
            }
          }
        }
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
        const ttl = (this.form.values as any).public?.chat_message_ttl ?? 3600;

        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: [
                  {
                    name: "public.chat_message_ttl",
                    value: String(ttl),
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
          title: this.$t("pages.settings.application.chat.updated"),
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
