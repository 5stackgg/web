<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import PluginCvarForm from "~/components/game-plugins/PluginCvarForm.vue";
import PluginConfigFile from "~/components/game-plugins/PluginConfigFile.vue";
import PluginForcedCvars from "~/components/game-plugins/PluginForcedCvars.vue";
import {
  cloneConfig,
  repoFileUrl,
  type PluginCvar,
} from "~/utilities/pluginConfig";

// One server's layer of a plugin's settings, over what the plugin's own page
// sets for every server. Apply only stages it: the server saves its settings
// together, with one restart.
const props = defineProps<{
  open: boolean;
  slug: string;
  cfg: string;
  config: unknown;
  inheritedCfg: string;
  inheritedConfig: unknown;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  apply: [value: { cfg: string; config: unknown }];
}>();

const { t } = useI18n();

// Columns newer than the generated client, so a plain document.
const PLUGIN = gql`
  query ServerPluginConfigPlugin($slug: String!) {
    game_plugins_by_pk(slug: $slug) {
      slug
      name
      cvars
      config_path
      config_cvar
      config_default
      config_schema
      config_shipped
      forced_cvars
      reported_cvars {
        name
        kind
        default_value
        description
      }
      versions {
        runtime
        version
        url
      }
    }
  }
`;

const { result } = useQuery(
  PLUGIN,
  () => ({ slug: props.slug }),
  () => ({
    enabled: props.open && !!props.slug,
    fetchPolicy: "no-cache",
    context: { optional: true },
  }),
);

const plugin = computed<Record<string, any> | null>(
  () => (result.value as any)?.game_plugins_by_pk ?? null,
);

const runtime = computed(
  () => useApplicationSettingsStore().gameServerPluginRuntime,
);

const draftCfg = ref("");
const draftConfig = ref<unknown>(null);
const configInvalid = ref(false);
const tab = ref("settings");
// The plugin's details arrive after the dialog opens, so its first tab is only
// known then; a tab the operator picked is not taken away from them.
const picked = ref(false);

const configPath = computed<string | null>(
  () =>
    plugin.value?.config_path?.replaceAll("{runtime}", runtime.value) ?? null,
);

const cvarRows = computed<Array<PluginCvar>>(() => {
  const reported = new Map(
    (plugin.value?.reported_cvars ?? []).map((cvar: Record<string, any>) => [
      cvar.name.toLowerCase(),
      cvar,
    ]),
  );
  const managed = configPath.value
    ? plugin.value?.config_cvar?.toLowerCase()
    : null;

  return (plugin.value?.cvars ?? [])
    .filter((name: string) => name.toLowerCase() !== managed)
    .map((name: string) => {
      const cvar = reported.get(name.toLowerCase()) as
        | Record<string, any>
        | undefined;

      return {
        name,
        kind: cvar?.kind ?? null,
        defaultValue: cvar?.default_value ?? null,
        description: cvar?.description || null,
      };
    });
});

const forced = computed<Array<string>>(() => plugin.value?.forced_cvars ?? []);

const tabs = computed(() => [
  ...(cvarRows.value.length > 0 || forced.value.length > 0
    ? [{ key: "settings", label: t("pages.plugins.tabs.settings") }]
    : []),
  ...(configPath.value
    ? [
        {
          key: "file",
          label:
            plugin.value?.config_schema?.title ??
            t("pages.plugins.config_file.title"),
        },
      ]
    : []),
  { key: "advanced", label: t("pages.plugins.tabs.advanced") },
]);

watch(tabs, (next) => {
  if (!picked.value || !next.some((entry) => entry.key === tab.value)) {
    tab.value = next[0].key;
  }
});

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }

    draftCfg.value = props.cfg;
    draftConfig.value = cloneConfig(props.config);
    configInvalid.value = false;
    picked.value = false;
    tab.value = tabs.value[0].key;
  },
  { immediate: true },
);

function pickTab(key: string) {
  picked.value = true;
  tab.value = key;
}

const repoUrl = computed(() => {
  const release = (plugin.value?.versions ?? []).find(
    (version: Record<string, any>) => version.runtime === runtime.value,
  );

  return repoFileUrl(release?.url, plugin.value?.config_shipped?.repo_path);
});

const usingText = computed(() =>
  props.inheritedConfig != null
    ? t("pages.dedicated_servers.detail.plugins.config.using_inherited")
    : t("pages.dedicated_servers.detail.plugins.config.using_shipped"),
);

function apply() {
  emit("apply", { cfg: draftCfg.value, config: draftConfig.value });
  emit("update:open", false);
}
</script>

<template>
  <Sheet :open="props.open" @update:open="emit('update:open', $event)">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 sm:max-w-2xl motion-reduce:animate-none"
    >
      <SheetHeader class="pr-8">
        <SheetTitle>
          {{
            $t("pages.dedicated_servers.detail.plugins.config.title", {
              plugin: plugin?.name ?? props.slug,
            })
          }}
        </SheetTitle>
        <SheetDescription>
          {{ $t("pages.dedicated_servers.detail.plugins.config.description") }}
        </SheetDescription>
      </SheetHeader>

      <AnimatedFilters
        v-if="tabs.length > 1"
        class="mt-5"
        :model-value="tab"
        square
        :options="tabs"
        @update:model-value="pickTab"
      />

      <div class="-mx-6 mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-4">
        <div v-show="tab === 'settings'" class="space-y-4">
          <PluginCvarForm
            v-if="cvarRows.length > 0"
            v-model="draftCfg"
            :cvars="cvarRows"
            :inherited="props.inheritedCfg"
          />
          <PluginForcedCvars
            :forced="forced"
            :cfg="draftCfg"
            :plugin-name="plugin?.name ?? props.slug"
          />
        </div>

        <PluginConfigFile
          v-if="configPath"
          v-show="tab === 'file'"
          v-model="draftConfig"
          :schema="plugin?.config_schema ?? null"
          :default-config="
            props.inheritedConfig ?? plugin?.config_default ?? null
          "
          :path="configPath"
          :repo-url="repoUrl"
          :can-open-shipped="false"
          :using-text="usingText"
          :reset-text="
            $t('pages.dedicated_servers.detail.plugins.config.remove_override')
          "
          @invalid="configInvalid = $event"
        />

        <div v-show="tab === 'advanced'" class="space-y-1.5">
          <Textarea
            v-model="draftCfg"
            rows="16"
            class="font-mono text-xs"
            spellcheck="false"
          />
          <p class="text-xs text-muted-foreground">
            {{
              $t("pages.dedicated_servers.detail.plugins.config.advanced_hint")
            }}
          </p>
        </div>
      </div>

      <div
        class="-mx-6 flex justify-end gap-2 border-t border-border/60 px-6 pt-4"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          @click="emit('update:open', false)"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          type="button"
          size="sm"
          :disabled="configInvalid"
          @click="apply"
        >
          {{ $t("pages.dedicated_servers.detail.plugins.config.apply") }}
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
