<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { Input } from "~/components/ui/input";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import { toast } from "@/components/ui/toast";
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";

definePageMeta({
  middleware: "admin",
});

const { client: apolloClient } = useApolloClient();
const { t } = useI18n();

const teamMinRosterSize = computed(
  () => useApplicationSettingsStore().teamMinRosterSize,
);
const teamMaxRosterSize = computed(
  () => useApplicationSettingsStore().teamMaxRosterSize,
);
const teamMaxSubs = computed(() => useApplicationSettingsStore().teamMaxSubs);

const minRosterInput = ref(teamMinRosterSize.value);
const maxRosterInput = ref(teamMaxRosterSize.value);
const subsInput = ref(teamMaxSubs.value);
watch(teamMinRosterSize, (v) => (minRosterInput.value = v));
watch(teamMaxRosterSize, (v) => (maxRosterInput.value = v));
watch(teamMaxSubs, (v) => (subsInput.value = v));

async function saveStringSetting(name: string, value: string) {
  await apolloClient.mutate({
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
  toast({ title: t("pages.settings.application.update_success") });
}

async function saveRosterSizes() {
  const min = Math.max(1, Math.min(minRosterInput.value || 1, 15));
  const max = Math.max(min, Math.min(maxRosterInput.value || min, 20));
  await saveStringSetting("public.team_min_roster_size", String(min));
  await saveStringSetting("public.team_max_roster_size", String(max));
}

async function saveSubs() {
  const subs = Math.max(0, Math.min(subsInput.value || 0, 10));
  await saveStringSetting("public.team_max_subs", String(subs));
}
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="team-roster"
          :title="$t('pages.settings.application.teams.roster_section')"
          :description="
            $t('pages.settings.application.teams.roster_description')
          "
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-sm font-medium">
                {{ $t("pages.settings.application.teams.min_roster") }}
              </label>
              <Input
                type="number"
                min="1"
                max="15"
                v-model.number="minRosterInput"
                @blur="saveRosterSizes"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium">
                {{ $t("pages.settings.application.teams.max_roster") }}
              </label>
              <Input
                type="number"
                min="1"
                max="20"
                v-model.number="maxRosterInput"
                @blur="saveRosterSizes"
              />
            </div>
          </div>
          <p class="mt-2 text-xs text-muted-foreground">
            {{ $t("pages.settings.application.teams.roster_hint") }}
          </p>

          <div class="mt-3 max-w-xs space-y-1.5">
            <label class="text-sm font-medium">
              {{ $t("pages.settings.application.teams.max_subs") }}
            </label>
            <Input
              type="number"
              min="0"
              max="10"
              v-model.number="subsInput"
              @blur="saveSubs"
            />
          </div>
        </SettingsSection>
      </div>
    </PageTransition>
  </SettingsPage>
</template>
