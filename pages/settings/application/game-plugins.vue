<script setup lang="ts">
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { RefreshCw } from "lucide-vue-next";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="game-plugins"
          :title="$t('pages.settings.application.game_plugins.section')"
          :description="
            $t('pages.settings.application.game_plugins.description')
          "
          clickable-header
          @header-click="toggleEnabled"
        >
          <template #action>
            <Switch
              :model-value="gamePluginsEnabled"
              @update:model-value="toggleEnabled"
            />
          </template>

          <p
            class="text-sm text-muted-foreground"
            v-if="!gamePluginsEnabled"
          >
            {{ $t("pages.settings.application.game_plugins.disabled_hint") }}
          </p>
        </SettingsSection>

        <template v-if="gamePluginsEnabled">
          <form class="space-y-6" @submit.prevent="updateSettings">
            <SettingsSection
              id="registry"
              :title="$t('pages.settings.application.game_plugins.registry')"
              :description="
                $t('pages.settings.application.game_plugins.registry_description')
              "
            >
              <FormField v-slot="{ componentField }" name="registryUrl">
                <FormItem>
                  <FormLabel>
                    {{
                      $t(
                        "pages.settings.application.game_plugins.registry_url",
                      )
                    }}
                  </FormLabel>
                  <div class="flex items-start gap-2">
                    <div class="flex-1">
                      <FormControl>
                        <Input
                          v-bind="componentField"
                          placeholder="https://registry.5stack.gg/"
                        />
                      </FormControl>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      class="gap-2 shrink-0"
                      :loading="syncing"
                      @click="syncRegistry"
                    >
                      <RefreshCw class="h-4 w-4" />
                      {{ $t("pages.settings.application.game_plugins.sync") }}
                    </Button>
                  </div>
                  <FormDescription>
                    {{
                      $t(
                        "pages.settings.application.game_plugins.catalog_count",
                        { count: plugins.length },
                      )
                    }}
                  </FormDescription>
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

        </template>
      </div>
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
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  data() {
    return {
      submitting: false,
      syncing: false,
      plugins: [] as Array<Record<string, unknown>>,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            registryUrl: z.string().url().or(z.literal("")).default(""),
          }),
        ),
      }),
    };
  },
  apollo: {
    plugins: {
      query: typedGql("query")({
        game_plugins: [
          {},
          {
            slug: true,
            name: true,
            kind: true,
            verified: true,
          },
        ],
      }),
      update(data: { game_plugins: Array<Record<string, unknown>> }) {
        return data.game_plugins;
      },
    },
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal: Array<{ name: string; value: string | null }>) {
        const registryUrl = newVal?.find(
          (setting) => setting.name === "game_plugin_registry_url",
        );

        if (registryUrl?.value) {
          this.form.setFieldValue("registryUrl", registryUrl.value);
        }

        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  methods: {
    async setSetting(name: string, value: string) {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: { name, value },
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            { __typename: true },
          ],
        }),
      });
    },
    async toggleEnabled() {
      await this.setSetting(
        "public.game_plugins_enabled",
        this.gamePluginsEnabled ? "false" : "true",
      );

      toast({
        title: this.$t("pages.settings.application.update_success") as string,
      });
    },
    async syncRegistry() {
      if (this.syncing) {
        return;
      }

      this.syncing = true;

      try {
        const { data } = await (this as any).$apollo.mutate({
          mutation: generateMutation({
            syncPluginRegistry: [{}, { plugins: true, versions: true }],
          }),
        });

        toast({
          title: this.$t(
            "pages.settings.application.game_plugins.synced",
            data?.syncPluginRegistry ?? { plugins: 0, versions: 0 },
          ) as string,
        });

        await (this as any).$apollo.queries.plugins.refetch();
      } catch (error) {
        toast({
          title: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        this.syncing = false;
      }
    },
    async updateSettings() {
      if (this.submitting) {
        return;
      }

      this.submitting = true;

      try {
        await this.setSetting(
          "game_plugin_registry_url",
          (this.form.values as { registryUrl?: string }).registryUrl ?? "",
        );

        toast({
          title: this.$t("pages.settings.application.update_success") as string,
        });
      } finally {
        this.submitting = false;
      }
    },
  },
  computed: {
    gamePluginsEnabled() {
      return useApplicationSettingsStore().gamePluginsEnabled;
    },
    settings() {
      return useApplicationSettingsStore().settings;
    },
  },
};
</script>
