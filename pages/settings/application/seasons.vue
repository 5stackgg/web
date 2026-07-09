<script setup lang="ts">
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import { Settings2 } from "lucide-vue-next";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="seasons"
          :title="$t('pages.settings.application.seasons.section')"
          :description="$t('pages.settings.application.seasons.description')"
          clickable-header
          @header-click="toggleEnabled"
        >
          <template #action>
            <Switch
              :model-value="seasonsEnabled"
              @update:model-value="toggleEnabled"
            />
          </template>

          <div
            v-if="seasonsEnabled"
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-sm text-muted-foreground">
              {{ $t("pages.settings.application.seasons.manage_description") }}
            </p>
            <NuxtLink to="/seasons">
              <Button variant="outline" class="gap-2 shrink-0">
                <Settings2 class="h-4 w-4" />
                {{ $t("pages.settings.application.seasons.manage") }}
              </Button>
            </NuxtLink>
          </div>
        </SettingsSection>
      </div>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import {
  settings_constraint,
  settings_update_column,
} from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

export default {
  computed: {
    seasonsEnabled() {
      return useApplicationSettingsStore().seasonsEnabled;
    },
  },
  methods: {
    async toggleEnabled() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.seasons_enabled",
                value: this.seasonsEnabled ? "false" : "true",
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
    },
  },
};
</script>
