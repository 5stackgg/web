<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card } from "~/components/ui/card";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <form @submit.prevent="updateSettings" class="grid gap-6">
      <Card variant="gradient">
        <div class="p-6 space-y-6">
          <div class="space-y-1">
            <h3 class="text-lg font-semibold">
              {{ $t("pages.settings.application.chat.title") }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ $t("pages.settings.application.chat.description") }}
            </p>
          </div>

          <FormField v-slot="{ componentField }" name="public.chat_message_ttl">
            <FormItem>
              <FormLabel class="text-lg font-semibold">
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
      },
    },
  },
  methods: {
    async updateSettings() {
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
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
  },
};
</script>
