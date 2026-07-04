<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <SettingsSection
        id="scrim-finder"
        :title="$t('pages.settings.application.scrim_finder.section')"
        :description="
          $t('pages.settings.application.scrim_finder.enabled_description')
        "
        clickable-header
        @header-click="save(!enabled)"
      >
        <template #action>
          <Switch :model-value="enabled" @update:model-value="save" />
        </template>
      </SettingsSection>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

export default {
  computed: {
    settings(): { name: string; value: string }[] {
      return useApplicationSettingsStore().settings;
    },
    enabled(): boolean {
      // Enabled by default — only an explicit "false" disables it.
      return (
        this.settings.find((s) => s.name === "public.scrim_finder_enabled")
          ?.value !== "false"
      );
    },
  },
  methods: {
    async save(value: boolean) {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "public.scrim_finder_enabled",
                  value: value ? "true" : "false",
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
        title: this.$t("pages.settings.application.scrim_finder.updated"),
      });
    },
  },
};
</script>
