<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Download, Eye, EyeOff, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import ClipBoard from "~/components/ClipBoard.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import { useServerPlayerManagementPlugin } from "~/composables/useServerPlayerManagementPlugin";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { effectivePluginRuntime } from "~/constants/rconCommands";
import {
  PLAYER_MANAGEMENT_CONFIG_PATHS,
  playerManagementConfig,
  playerManagementDownloadUrl,
} from "~/constants/gameServerReleases";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  serverId: string;
  gameServerNodeId: string | null;
  apiPassword?: string | null;
  pluginRuntime?: string | null;
}>();

const { t } = useI18n();
const authStore = useAuthStore();
const applicationSettings = useApplicationSettingsStore();
const plugin = useServerPlayerManagementPlugin(() => props.serverId);

const showConfig = ref(false);
const selectedRuntime = ref<string | null>(null);

// A server on a node gets the plugin baked into its image, and only an
// administrator can read the api password the config needs.
const canInstall = computed(
  () => props.gameServerNodeId === null && authStore.isAdmin,
);

const notDetectedMessage = computed(() =>
  t(
    props.gameServerNodeId === null
      ? "pages.dedicated_servers.detail.player_management_plugin.not_detected_external"
      : "pages.dedicated_servers.detail.player_management_plugin.not_detected_node",
  ),
);

const installRuntime = computed({
  get: () =>
    selectedRuntime.value ??
    effectivePluginRuntime(
      plugin.server.value?.player_management_runtime ?? props.pluginRuntime,
      applicationSettings.gameServerPluginRuntime,
    ),
  set: (runtime: string) => {
    selectedRuntime.value = runtime;
  },
});

const downloadUrl = computed(() =>
  playerManagementDownloadUrl(
    installRuntime.value,
    applicationSettings.latestPluginVersion(installRuntime.value),
  ),
);

const downloadName = computed(() => {
  const file = downloadUrl.value.split("/").pop() ?? "";

  return file.endsWith(".zip") ? file : null;
});

const configPath = computed(
  () => PLAYER_MANAGEMENT_CONFIG_PATHS[installRuntime.value],
);

const config = computed(() =>
  playerManagementConfig(installRuntime.value, {
    apiDomain: `https://${useRuntimeConfig().public.apiDomain}`,
    serverId: props.serverId,
    apiPassword: props.apiPassword,
  }),
);

const stepClasses =
  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 font-mono text-[0.65rem] text-muted-foreground";
</script>

<template>
  <section class="grid gap-4" data-testid="player-management-plugin">
    <div :class="[tacticalSectionLabelClasses, 'mb-0']">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("pages.dedicated_servers.detail.player_management") }}
    </div>

    <div
      v-if="!plugin.loaded.value"
      class="grid gap-2 rounded-md border border-border bg-muted/20 p-4"
      data-testid="plugin-status-loading"
    >
      <Skeleton class="h-3 w-56" />
      <Skeleton class="h-3 w-72" />
    </div>

    <div v-else class="rounded-md border border-border bg-muted/20 p-4">
      <div
        class="flex items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em]"
        :class="
          plugin.active.value ? 'text-success' : 'text-[hsl(var(--tac-amber))]'
        "
      >
        <span
          v-if="plugin.active.value"
          class="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
        />
        <TriangleAlert v-else class="h-3.5 w-3.5 shrink-0" />
        {{
          plugin.active.value
            ? $t("pages.dedicated_servers.detail.player_management_plugin.active")
            : $t(
                "pages.dedicated_servers.detail.player_management_plugin.not_detected_title",
              )
        }}
      </div>
      <p
        v-if="plugin.versionLabel.value"
        class="mt-1.5 font-mono text-xs text-muted-foreground"
      >
        {{ plugin.versionLabel.value }}
        <template v-if="plugin.runtimeLabel.value">
          · {{ plugin.runtimeLabel.value }}
        </template>
        <template v-if="plugin.server.value?.player_management_seen_at">
          ·
          {{
            $t(
              "pages.dedicated_servers.detail.player_management_plugin.last_check_in",
            )
          }}
          <TimeAgo
            :date="plugin.server.value.player_management_seen_at"
            hide-icon
            class="text-foreground"
          />
        </template>
      </p>
      <p
        v-if="!plugin.active.value"
        class="mt-1.5 text-sm text-muted-foreground"
      >
        {{ notDetectedMessage }}
      </p>
    </div>

    <div v-if="canInstall" class="rounded-md border border-border p-4">
      <div
        class="mb-4 inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground"
      >
        <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]" />
        {{
          $t(
            "pages.dedicated_servers.detail.player_management_plugin.install_steps",
          )
        }}
      </div>
      <ol class="space-y-4">
        <li class="flex gap-3">
          <span :class="stepClasses">1</span>
          <div class="min-w-0 flex-1 space-y-3">
            <p class="text-sm">
              {{
                $t(
                  "pages.dedicated_servers.detail.player_management_plugin.step_download",
                )
              }}
            </p>
            <Tabs v-model="installRuntime" :scroll-floor="false">
              <TabsList>
                <TabsTrigger value="swiftlys2">SwiftlyS2</TabsTrigger>
                <TabsTrigger value="counterstrikesharp">
                  CounterStrikeSharp
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button as-child variant="outline" size="sm">
              <a :href="downloadUrl" target="_blank" rel="noopener noreferrer">
                <Download class="mr-2 h-4 w-4" />
                <span v-if="downloadName" class="font-mono text-xs">
                  {{ downloadName }}
                </span>
                <template v-else>{{ $t("common.download") }}</template>
              </a>
            </Button>
          </div>
        </li>
        <li class="flex gap-3">
          <span :class="stepClasses">2</span>
          <p class="flex-1 text-sm">
            {{
              $t(
                "pages.dedicated_servers.detail.player_management_plugin.step_extract",
              )
            }}
          </p>
        </li>
        <li class="flex gap-3">
          <span :class="stepClasses">3</span>
          <div class="min-w-0 flex-1 space-y-2">
            <p class="text-sm">
              {{
                $t(
                  "pages.dedicated_servers.detail.player_management_plugin.step_config",
                )
              }}
            </p>
            <div class="flex items-center gap-2">
              <code
                class="min-w-0 break-all rounded bg-secondary px-1.5 py-0.5 text-xs"
              >
                {{ configPath }}
              </code>
              <ClipBoard :data="configPath" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              :aria-expanded="showConfig"
              @click="showConfig = !showConfig"
            >
              <Eye v-if="!showConfig" class="mr-2 h-4 w-4" />
              <EyeOff v-else class="mr-2 h-4 w-4" />
              {{
                showConfig
                  ? $t("pages.dedicated_servers.detail.hide_config")
                  : $t("pages.dedicated_servers.detail.show_config")
              }}
            </Button>
            <div v-if="showConfig" class="relative">
              <pre
                class="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 pr-14 font-mono text-xs"
              ><code>{{ config }}</code></pre>
              <div class="absolute right-2 top-2">
                <ClipBoard :data="config" />
              </div>
            </div>
          </div>
        </li>
        <li class="flex gap-3">
          <span :class="stepClasses">4</span>
          <p class="flex-1 text-sm">
            {{
              $t(
                "pages.dedicated_servers.detail.player_management_plugin.step_restart",
              )
            }}
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
