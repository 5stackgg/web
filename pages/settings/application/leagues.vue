<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import DivisionTierEditor from "~/components/league/DivisionTierEditor.vue";
import { Settings2 } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  LEAGUE_OVERVIEW_QUERY,
  UPSERT_DIVISION_MUTATION,
  DELETE_DIVISION_MUTATION,
  REORDER_DIVISIONS_MUTATION,
} from "~/graphql/leagues";

definePageMeta({
  middleware: "admin",
});

const { client: apolloClient } = useApolloClient();
const { t } = useI18n();

const leaguesEnabled = computed(
  () => useApplicationSettingsStore().leaguesEnabled,
);
const leagueAllowDivisionRequest = computed(
  () => useApplicationSettingsStore().leagueAllowDivisionRequest,
);

const divisions = ref<any[]>([]);

async function fetchDivisions() {
  const { data } = await apolloClient.query({
    query: LEAGUE_OVERVIEW_QUERY,
    fetchPolicy: "network-only",
  });
  divisions.value = data?.league_divisions ?? [];
}

onMounted(() => {
  if (leaguesEnabled.value) {
    fetchDivisions();
  }
});

watch(leaguesEnabled, (enabled) => {
  if (enabled) {
    fetchDivisions();
  }
});

function onError(error: any) {
  toast({ title: error?.message ?? String(error), variant: "destructive" });
}

async function saveBooleanSetting(name: string, value: boolean) {
  await apolloClient.mutate({
    mutation: generateMutation({
      insert_settings_one: [
        {
          object: { name, value: value ? "true" : "false" },
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

async function toggleEnabled() {
  await saveBooleanSetting("public.leagues_enabled", !leaguesEnabled.value);
}

async function toggleAllowDivisionRequest() {
  await saveBooleanSetting(
    "public.league_allow_division_request",
    !leagueAllowDivisionRequest.value,
  );
}

async function createDivision(name: string, tier: number) {
  try {
    await apolloClient.mutate({
      mutation: UPSERT_DIVISION_MUTATION,
      variables: { name, tier },
    });
    await fetchDivisions();
  } catch (error) {
    onError(error);
  }
}

async function deleteDivision(divisionId: string) {
  try {
    await apolloClient.mutate({
      mutation: DELETE_DIVISION_MUTATION,
      variables: { divisionId },
    });
    await fetchDivisions();
  } catch (error) {
    onError(error);
  }
}

async function reorderDivisions(divisionIds: string[]) {
  try {
    await apolloClient.mutate({
      mutation: REORDER_DIVISIONS_MUTATION,
      variables: { divisionIds: `{${divisionIds.join(",")}}` },
    });
    await fetchDivisions();
  } catch (error) {
    onError(error);
  }
}
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="leagues"
          :title="$t('pages.settings.application.leagues.section')"
          :description="$t('pages.settings.application.leagues.description')"
          clickable-header
          @header-click="toggleEnabled"
        >
          <template #action>
            <Switch
              :model-value="leaguesEnabled"
              @update:model-value="toggleEnabled"
            />
          </template>

          <div
            v-if="leaguesEnabled"
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-sm text-muted-foreground">
              {{ $t("pages.settings.application.leagues.manage_description") }}
            </p>
            <NuxtLink to="/league">
              <Button variant="outline" class="gap-2 shrink-0">
                <Settings2 class="h-4 w-4" />
                {{ $t("pages.settings.application.leagues.manage") }}
              </Button>
            </NuxtLink>
          </div>
        </SettingsSection>

        <SettingsSection
          v-if="leaguesEnabled"
          id="league-divisions"
          :title="$t('pages.settings.application.leagues.divisions_section')"
          :description="
            $t('pages.settings.application.leagues.divisions_description')
          "
        >
          <DivisionTierEditor
            :divisions="divisions"
            @create="createDivision"
            @delete="deleteDivision"
            @reorder="reorderDivisions"
          />
        </SettingsSection>

        <SettingsSection
          v-if="leaguesEnabled"
          id="league-registration"
          :title="$t('pages.settings.application.leagues.registration_section')"
          :description="
            $t('pages.settings.application.leagues.registration_description')
          "
        >
          <div
            class="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-4"
          >
            <div>
              <p class="text-sm font-medium">
                {{
                  $t("pages.settings.application.leagues.allow_request_title")
                }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ $t("pages.settings.application.leagues.allow_request_hint") }}
              </p>
            </div>
            <Switch
              :model-value="leagueAllowDivisionRequest"
              @update:model-value="toggleAllowDivisionRequest"
            />
          </div>
        </SettingsSection>
      </div>
    </PageTransition>
  </SettingsPage>
</template>
