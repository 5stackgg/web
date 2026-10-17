<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import ServiceLogs from "~/components/ServiceLogs.vue";
import { Fold } from "~/components/ui/transitions";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import NodeMeter from "~/components/game-server-nodes/NodeMeter.vue";
import {
  CircleAlert,
  CircleArrowUp,
  Download,
  LoaderCircle,
  Pin,
} from "lucide-vue-next";
import {
  isGpuOnly,
  isReachable,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import {
  cs2State,
  updateProgress,
  type NextStep,
} from "~/components/game-server-nodes/nodeInspector";
import {
  INSPECTOR,
  TONE_TEXT,
  updateTarget,
  versionShort,
} from "~/components/game-server-nodes/nodeCopy";
import { relativeTime } from "~/components/game-server-nodes/nodeFormat";
import { dateLocale } from "~/utilities/dateLocale";

// CS2 & plugins: the build and its pin, the plugin and its pin, CS:GO, and
// the update log. The version picker and Update share a line; the state and
// build read as one sentence under them.
const props = defineProps<{
  node: NodeLike & Record<string, any>;
  gameVersions: Array<Record<string, any>>;
  pluginVersions: Array<Record<string, any>>;
  pluginRuntime: string;
  supportsPinning: boolean;
  pinBuild: number | string | null;
  pinPlugin: string | null;
  currentBuildId: number | string | null;
  nextStep: NextStep | null;
  logOpen: boolean;
}>();

const emit = defineEmits<{
  pinBuild: [buildId: number | null];
  pinPlugin: [version: string | null];
  updateCs: [];
  updateCsgo: [];
  "update:logOpen": [open: boolean];
}>();

const { t } = useI18n();

const valClasses =
  "-ml-2 h-7 w-auto min-w-0 max-w-full gap-1.5 border-transparent bg-transparent px-2 py-0 text-[13px] shadow-none transition-colors hover:border-border hover:bg-muted/40 focus:ring-0 focus-visible:ring-1 data-[state=open]:border-border";

const inSetup = computed(() => props.node.status === "Setup");
const gpuOnly = computed(() => isGpuOnly(props.node));
const reachable = computed(() => isReachable(props.node));
const state = computed(() => cs2State(props.node, props.currentBuildId));
const progress = computed(() => updateProgress(props.node.update_status));

// The header already offers it; the section doesn't repeat the button.
const headerUpdates = computed(
  () =>
    props.nextStep === "install_cs2" ||
    props.nextStep === "update_cs2" ||
    props.nextStep === "retry_update",
);

const target = computed(() =>
  versionShort(
    props.gameVersions as any,
    props.node.pin_build_id ||
      props.gameVersions.find((version) => version.current)?.build_id,
  ),
);
const targetLabel = computed(() =>
  updateTarget(props.gameVersions as any, props.node),
);

// A pin has to name a version in the runtime the node boots; an existing pin
// from the other framework stays listed so the select can show it.
const plugins = computed(() =>
  props.pluginVersions.filter(
    (version) =>
      version.runtime === props.pluginRuntime ||
      (version.runtime === props.node.pin_plugin_runtime &&
        version.version === props.node.pin_plugin_version),
  ),
);
const latestPlugin = computed(
  () =>
    props.pluginVersions.find(
      (version) => version.runtime === props.pluginRuntime,
    )?.version ?? "",
);

const when = (value: string) =>
  value ? new Date(value).toLocaleString(dateLocale()) : "";

const statusText = computed(() => {
  const text = String(props.node.update_status ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
});
</script>

<template>
  <section class="grid gap-2.5 p-4">
    <h3 class="text-[13px] font-semibold">
      {{ t(`${INSPECTOR}.sections.cs2`) }}
    </h3>

    <p v-if="inSetup" class="text-xs text-muted-foreground">
      {{ t(`${INSPECTOR}.cs2.setup`) }}
    </p>
    <p v-else-if="gpuOnly" class="text-xs text-muted-foreground">
      {{ t(`${INSPECTOR}.cs2.gpu_only`) }}
    </p>

    <div v-else class="gsn-kv">
      <span class="gsn-k">CS2</span>
      <div class="gsn-v">
        <div v-if="state === 'updating'" class="grid min-w-0 flex-1 gap-1.5">
          <div class="flex min-w-0 items-center gap-1.5 text-[12.5px]">
            <LoaderCircle
              class="h-3 w-3 shrink-0 animate-spin text-info motion-reduce:animate-none"
            />
            <span class="truncate">{{ statusText }}</span>
            <span class="grow"></span>
            <span
              v-if="target"
              class="whitespace-nowrap font-mono text-xs text-muted-foreground/70"
              >{{ t(`${INSPECTOR}.cs2.to`, { version: target }) }}</span
            >
          </div>
          <NodeMeter
            v-if="progress != null"
            :value="progress"
            tone="info"
            thin
          />
        </div>

        <!-- A failed pinned update deletes the install but keeps the pin, so a
             pinned node with no build still gets the picker below: it is the
             only place to change or remove the pin. -->
        <template v-else-if="state === 'missing' && !node.pin_build_id">
          <span class="text-muted-foreground/70">{{
            t("pages.game_server_nodes.row.not_installed")
          }}</span>
          <Button
            v-if="!headerUpdates"
            size="xs"
            variant="outline"
            class="h-6 gap-1 text-xs"
            :disabled="!reachable"
            @click="emit('updateCs')"
          >
            <Download class="h-3 w-3" />
            {{ t("game_server.install_cs") }}
          </Button>
        </template>

        <div v-else class="gsn-c2l">
          <Select
            :model-value="(pinBuild ?? null) as any"
            :disabled="!supportsPinning"
            @update:model-value="
              (value) =>
                emit('pinBuild', value ? parseInt(String(value)) : null)
            "
          >
            <SelectTrigger
              :class="[valClasses, 'justify-self-start']"
              :aria-label="t('pages.game_server_nodes.table.cs2_build')"
            >
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="truncate">{{
                  versionShort(
                    gameVersions as any,
                    node.build_id || node.pin_build_id,
                  )
                }}</span>
                <Pin v-if="pinBuild" class="h-3 w-3 shrink-0 text-info" />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem :value="null as any">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-medium">{{
                      t("game_server.unpin_build_id")
                    }}</span>
                    <span class="text-xs text-muted-foreground">{{
                      t("game_server.use_latest_version")
                    }}</span>
                  </div>
                </SelectItem>
                <SelectItem
                  v-for="version of gameVersions"
                  :key="version.build_id"
                  :value="version.build_id"
                >
                  <div class="flex flex-col gap-0.5">
                    <span class="flex items-center gap-1">
                      <span class="font-medium">{{ version.version }}</span>
                      <span class="font-mono text-xs text-muted-foreground"
                        >({{ version.build_id }})</span
                      >
                      <Pin
                        v-if="String(pinBuild) === String(version.build_id)"
                        class="ml-1 h-3 w-3 text-info"
                      />
                    </span>
                    <span class="text-xs text-muted-foreground">
                      {{ when(version.updated_at) }}
                      <span v-if="version.current" class="ml-1 text-success"
                        >({{ t("game_server.current") }})</span
                      >
                    </span>
                  </div>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button
            v-if="
              (state === 'behind' ||
                state === 'failed' ||
                state === 'missing') &&
              !headerUpdates
            "
            size="xs"
            variant="outline"
            class="gsn-c2b h-6 gap-1 text-xs"
            :disabled="!reachable"
            @click="emit('updateCs')"
          >
            <template v-if="state === 'missing'">
              <Download class="h-3 w-3" />
              {{ t("game_server.install_cs") }}
            </template>
            <template v-else>{{ t("common.update") }}</template>
          </Button>

          <p v-if="state === 'missing'" class="gsn-c2s">
            <span class="gsn-st text-muted-foreground">{{
              t("pages.game_server_nodes.row.not_installed")
            }}</span>
            ·
            <span class="gsn-st text-info"
              ><Pin class="h-3 w-3" />{{ t(`${INSPECTOR}.chip.pinned`) }}</span
            >
          </p>
          <p v-else class="gsn-c2s">
            <span
              v-if="state === 'behind'"
              class="gsn-st"
              :class="TONE_TEXT.warn"
              ><CircleArrowUp class="h-3 w-3" />{{
                t(`${INSPECTOR}.chip.behind`)
              }}</span
            ><span
              v-else-if="state === 'failed'"
              class="gsn-st"
              :class="TONE_TEXT.bad"
              ><CircleAlert class="h-3 w-3" />{{
                t(`${INSPECTOR}.chip.failed`)
              }}</span
            ><span v-else-if="state === 'pinned'" class="gsn-st text-info"
              ><Pin class="h-3 w-3" />{{ t(`${INSPECTOR}.chip.pinned`) }}</span
            ><span v-else class="gsn-st text-muted-foreground">{{
              t("pages.game_server_nodes.builds.current")
            }}</span>
            ·
            <i18n-t
              :keypath="
                state === 'behind'
                  ? `${INSPECTOR}.cs2.behind_line`
                  : state === 'failed'
                    ? `${INSPECTOR}.cs2.failed_line`
                    : `${INSPECTOR}.cs2.build_line`
              "
              scope="global"
            >
              <template #build>
                <span class="font-mono text-[11.5px] text-foreground">{{
                  node.build_id
                }}</span>
              </template>
              <template #target>{{ targetLabel }}</template>
              <template #ago>{{
                relativeTime(node.update_failed_at)
              }}</template>
            </i18n-t>
            <template v-if="!supportsPinning">
              ·
              <a
                href="https://docs.5stack.gg/servers/game-server-nodes/version-pinning"
                target="_blank"
                rel="noopener"
                class="underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
                :title="t('game_server.version_pinning_not_supported')"
                >{{ t(`${INSPECTOR}.cs2.pinning_unsupported`) }}</a
              >
            </template>
          </p>
        </div>
      </div>

      <span class="gsn-k">{{ t("pages.game_server_nodes.table.plugin") }}</span>
      <div class="gsn-v">
        <div class="gsn-c2l">
          <Select
            :model-value="(pinPlugin ?? null) as any"
            :disabled="!node.build_id"
            @update:model-value="
              (value) => emit('pinPlugin', (value as any) ?? null)
            "
          >
            <SelectTrigger
              :class="[valClasses, 'justify-self-start']"
              :aria-label="t('common.plugin_version')"
            >
              <span class="flex min-w-0 items-center gap-1.5">
                <template v-if="pinPlugin">
                  <Pin class="h-3 w-3 text-info" />
                  <span class="truncate tabular-nums">{{ pinPlugin }}</span>
                </template>
                <template v-else>
                  <span>{{ t("game_server.auto") }}</span>
                  <span
                    v-if="latestPlugin"
                    class="font-mono text-xs text-muted-foreground/70"
                    >{{ latestPlugin }}</span
                  >
                </template>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem :value="null as any">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-medium">{{
                      t("game_server.unpin_plugin_version")
                    }}</span>
                    <span class="text-xs text-muted-foreground">{{
                      t("game_server.use_latest_plugin")
                    }}</span>
                  </div>
                </SelectItem>
                <SelectItem
                  v-for="version of plugins"
                  :key="`${version.runtime}:${version.version}`"
                  :value="version.version"
                >
                  <div class="flex flex-col gap-0.5">
                    <span class="flex items-center gap-1">
                      <span class="font-medium">{{ version.version }}</span>
                      <Pin
                        v-if="pinPlugin === version.version"
                        class="ml-1 h-3 w-3 text-info"
                      />
                    </span>
                    <span class="text-xs text-muted-foreground">
                      <span
                        v-if="version.min_game_build_id"
                        :class="
                          Number(node.build_id || 0) >=
                          Number(version.min_game_build_id)
                            ? 'text-success'
                            : TONE_TEXT.warn
                        "
                      >
                        {{ t("game_server.plugin_version_supports") }}
                        {{ version.min_game_build_id }}+ ·
                      </span>
                      {{ t("game_server.plugin_version_published") }}
                      {{ when(version.published_at) }}
                    </span>
                  </div>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p
            v-if="node.build_id && node.plugin_supported === false"
            class="gsn-c2s"
          >
            <span class="gsn-st" :class="TONE_TEXT.bad"
              ><CircleAlert class="h-3 w-3" />{{
                t(`${INSPECTOR}.cs2.plugin_unsupported`)
              }}</span
            >
            <i18n-t :keypath="`${INSPECTOR}.cs2.on_build`" scope="global">
              <template #build>
                <span class="font-mono text-[11.5px] text-foreground">{{
                  node.build_id
                }}</span>
              </template>
            </i18n-t>
          </p>
        </div>
      </div>

      <span class="gsn-k">CS:GO</span>
      <div class="gsn-v">
        <span v-if="node.csgo_build_id" class="font-mono text-xs">{{
          node.csgo_build_id
        }}</span>
        <span v-else class="text-muted-foreground/70">{{
          t("pages.game_server_nodes.row.not_installed")
        }}</span>
        <Button
          size="xs"
          variant="ghost"
          class="h-6 text-xs"
          :disabled="!reachable"
          @click="emit('updateCsgo')"
        >
          {{
            node.csgo_build_id
              ? t("game_server.update_csgo")
              : t("game_server.install_csgo")
          }}
        </Button>
      </div>

      <div class="col-span-full grid justify-items-start gap-2 pt-0.5">
        <button
          type="button"
          class="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
          :aria-expanded="logOpen"
          @click="emit('update:logOpen', !logOpen)"
        >
          {{ t(`${INSPECTOR}.cs2.update_log`) }}
        </button>
        <div class="w-full">
          <Fold :open="logOpen">
            <ServiceLogs :service="`cs-update:${node.id}`" :compact="true" />
          </Fold>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gsn-kv {
  display: grid;
  grid-template-columns: minmax(92px, 32%) minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 2px;
  font-size: 13px;
}
.gsn-k {
  color: hsl(var(--muted-foreground));
}
.gsn-v {
  display: flex;
  min-width: 0;
  min-height: 30px;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.gsn-c2l {
  display: grid;
  flex: 1;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 8px;
  padding: 3px 0;
}
.gsn-c2b {
  grid-column: 2;
  grid-row: 1;
}
.gsn-c2s {
  grid-column: 1 / -1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}
.gsn-st {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  vertical-align: -1px;
}
</style>
