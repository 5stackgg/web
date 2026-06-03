<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <SettingsSection
        id="external-matches"
        :title="$t('pages.settings.application.external_matches.section')"
      >
        <div
          class="flex cursor-pointer flex-row items-center justify-between"
          @click="save(!enabled)"
        >
          <div class="space-y-0.5">
            <h4 class="text-base font-medium">
              {{ $t("pages.settings.application.external_matches.enabled") }}
            </h4>
            <p class="text-sm text-muted-foreground">
              {{
                $t(
                  "pages.settings.application.external_matches.enabled_description",
                )
              }}
            </p>
          </div>
          <Switch :model-value="enabled" @update:model-value="save" />
        </div>
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
    settings() {
      return useApplicationSettingsStore().settings;
    },
    enabled(): boolean {
      return (
        this.settings.find(
          (s: { name: string }) =>
            s.name === "public.external_matches_enabled",
        )?.value === "true"
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
                  name: "public.external_matches_enabled",
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
        title: this.$t("pages.settings.application.external_matches.updated"),
      });
    },
  },
};
</script>
