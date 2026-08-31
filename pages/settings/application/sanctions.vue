<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import SanctionSourceSettings from "~/components/settings/SanctionSourceSettings.vue";
import { toast } from "@/components/ui/toast";
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { SANCTION_POLICY_QUERY } from "~/graphql/sanctions";
import {
  cloneSanctionPolicy,
  defaultSanctionPolicy,
  resolveSanctionPolicy,
  sanctionPoliciesEqual,
  sanctionPolicyRows,
  type SanctionPolicy,
  type SanctionScope,
  type SanctionSource,
} from "~/utilities/sanctions";

const { client: apolloClient } = useApolloClient();
const { t } = useI18n();

const sources = ref<SanctionSource[]>([]);
const scopes = ref<SanctionScope[]>([]);
const loaded = ref(false);
const submitting = ref(false);

const settings = computed(() => useApplicationSettingsStore().settings);

const storedValues = computed(
  () => new Map(settings.value.map((setting) => [setting.name, setting.value])),
);

/** Settings applied over the defaults — what the API would resolve right now. */
const resolved = computed<Record<string, SanctionPolicy>>(() => {
  const map: Record<string, SanctionPolicy> = {};
  for (const source of sources.value) {
    map[source.value] = resolveSanctionPolicy(
      source,
      storedValues.value,
      scopes.value,
    );
  }
  return map;
});

// What the server last told us, and what the operator is editing. Kept apart so
// a settings delivery arriving mid-edit (the store holds a live subscription)
// re-baselines the untouched sources without discarding the one being typed in.
const baseline = ref<Record<string, SanctionPolicy>>({});
const drafts = ref<Record<string, SanctionPolicy>>({});

watch(
  resolved,
  (next) => {
    for (const [source, policy] of Object.entries(next)) {
      const previous = baseline.value[source];
      const draft = drafts.value[source];
      const untouched =
        !draft || !previous || sanctionPoliciesEqual(draft, previous);
      if (untouched) {
        drafts.value[source] = cloneSanctionPolicy(policy);
      }
      baseline.value[source] = cloneSanctionPolicy(policy);
    }
  },
  { immediate: true },
);

const defaults = computed<Record<string, SanctionPolicy>>(() =>
  Object.fromEntries(
    sources.value.map((source) => [
      source.value,
      defaultSanctionPolicy(source),
    ]),
  ),
);

const dirty = computed(() =>
  sources.value.some((source) => {
    const draft = drafts.value[source.value];
    const current = baseline.value[source.value];
    return !!draft && !!current && !sanctionPoliciesEqual(draft, current);
  }),
);

/**
 * Only the sources whose draft has landed. Assembled here rather than looked up
 * per-row in the template so the child is never handed an undefined policy on
 * the one tick between the source list arriving and the watcher filling drafts.
 */
const sections = computed(() =>
  sources.value.flatMap((source) => {
    const policy = drafts.value[source.value];
    const shipped = defaults.value[source.value];
    if (!policy || !shipped) {
      return [];
    }
    return [{ source, policy, defaults: shipped }];
  }),
);

async function load() {
  const { data } = await apolloClient.query({
    query: SANCTION_POLICY_QUERY,
    fetchPolicy: "network-only",
  });
  sources.value = data?.e_sanction_sources ?? [];
  scopes.value = data?.e_sanction_scopes ?? [];
  loaded.value = true;
}

onMounted(() => {
  load().catch((error: unknown) => {
    loaded.value = true;
    toast({
      title: t("pages.settings.application.sanctions.load_failed"),
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    });
  });
});

function discard() {
  for (const source of sources.value) {
    const current = baseline.value[source.value];
    if (current) {
      drafts.value[source.value] = cloneSanctionPolicy(current);
    }
  }
}

/**
 * Only the rows whose stored text actually changed are written. Every other
 * `settings` row is left alone, so an untouched source keeps its seeded default
 * (or its absence) rather than being materialised by the act of saving another
 * source's ladder.
 *
 * There is no validation gate here on purpose: the inputs can only produce
 * clamped integers and a CSV rebuilt from numbers, which is exactly what the
 * API's `^\s*\d+\s*(,\s*\d+\s*)*$` / `^-?[0-9]+$` checks accept. The failure
 * mode this page exists to prevent — a value the API silently discards in
 * favour of the default — is unreachable by construction.
 */
async function save() {
  if (submitting.value || !dirty.value) {
    return;
  }

  const objects: Array<{ name: string; value: string }> = [];
  for (const source of sources.value) {
    const draft = drafts.value[source.value];
    if (!draft) {
      continue;
    }
    for (const row of sanctionPolicyRows(source.value, draft)) {
      if (storedValues.value.get(row.name) !== row.value) {
        objects.push(row);
      }
    }
  }

  if (objects.length === 0) {
    return;
  }

  submitting.value = true;
  try {
    await apolloClient.mutate({
      mutation: generateMutation({
        insert_settings: [
          {
            objects,
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
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="sanctions"
          :title="$t('pages.settings.application.sanctions.section')"
          :description="$t('pages.settings.application.sanctions.description')"
        >
          <!-- Said before the first toggle: the shipped values reproduce the
               behaviour that was hardcoded before this page existed, so an
               operator who reads the page and saves nothing changes nothing. -->
          <p class="text-xs text-muted-foreground/70">
            {{ $t("pages.settings.application.sanctions.defaults_note") }}
          </p>
        </SettingsSection>

        <SanctionSourceSettings
          v-for="section in sections"
          :key="section.source.value"
          :source="section.source"
          :scopes="scopes"
          :policy="section.policy"
          :defaults="section.defaults"
          @update:policy="(policy) => (drafts[section.source.value] = policy)"
        />

        <div
          v-if="loaded && sources.length === 0"
          class="rounded-sm border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {{ $t("pages.settings.application.sanctions.unavailable") }}
        </div>

        <SettingsSaveBar
          :dirty="dirty"
          :submitting="submitting"
          @save="save"
          @discard="discard"
        />
      </div>
    </PageTransition>
  </SettingsPage>
</template>
