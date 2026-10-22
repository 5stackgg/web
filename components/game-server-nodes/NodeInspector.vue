<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { toast } from "@/components/ui/toast";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import ClipBoard from "~/components/ClipBoard.vue";
import { Fold } from "~/components/ui/transitions";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import NodeStatusDot from "~/components/game-server-nodes/NodeStatusDot.vue";
import InspectorCapacity from "~/components/game-server-nodes/InspectorCapacity.vue";
import InspectorCs2 from "~/components/game-server-nodes/InspectorCs2.vue";
import InspectorCsgo from "~/components/game-server-nodes/InspectorCsgo.vue";
import UpdateLogSheet from "~/components/game-server-nodes/UpdateLogSheet.vue";
import InspectorDisk from "~/components/game-server-nodes/InspectorDisk.vue";
import InspectorHardware from "~/components/game-server-nodes/InspectorHardware.vue";
import InspectorLive from "~/components/game-server-nodes/InspectorLive.vue";
import InspectorGpu from "~/components/game-server-nodes/InspectorGpu.vue";
import InspectorNode from "~/components/game-server-nodes/InspectorNode.vue";
import EditCs2Options from "~/components/game-server-nodes/EditCs2Options.vue";
import LastChangedFor from "~/components/admin/LastChangedFor.vue";
import {
  ChevronDown,
  CircleAlert,
  CircleArrowUp,
  Download,
  FolderOpen,
  Globe,
  Info,
  Network,
  Pencil,
  Power,
  Puzzle,
  RotateCw,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-vue-next";
import {
  isGpuOnly,
  isOffline,
  maxServers as maxServersOf,
  nodeStatus,
  type CpuPinning,
  type IssueContext,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import {
  csgoState,
  nextStep,
  nodeAttention,
  type AttentionItem,
  type NextStep,
} from "~/components/game-server-nodes/nodeInspector";
import type { MetricRangeKey } from "~/components/game-server-nodes/nodeMetrics";
import {
  setNodeFields,
  updateGame,
} from "~/components/game-server-nodes/nodeActions";
import {
  attentionCopy,
  INSPECTOR,
} from "~/components/game-server-nodes/nodeCopy";
import { TONE_TEXT } from "~/components/admin/tone";

// One node, docked beside the table (or in a sheet when there's no room): a
// sticky header with the node's one next step, a callout for what is wrong,
// then the sections. Docked wide, Live and Disk take a left column that stays
// in view while the rest scrolls on the right; anywhere narrower it is one
// column, Live first.
export type InspectorRequest = {
  nodeId: string;
  kind: "rename" | "ports";
  n: number;
};

type OptimisticField = "region" | "pin_build_id" | "pin_plugin_version";

const props = defineProps<{
  node: NodeLike & Record<string, any>;
  gameVersions: Array<Record<string, any>>;
  pluginVersions: Array<Record<string, any>>;
  serverRegions: Array<{ value: string; description?: string | null }>;
  context: IssueContext;
  pinning: CpuPinning;
  stats: any;
  range: MetricRangeKey;
  request?: InspectorRequest | null;
}>();

const emit = defineEmits<{
  close: [];
  remove: [];
  files: [];
  "update:range": [range: MetricRangeKey];
}>();

const { t } = useI18n();
const { client } = useApolloClient();
const settings = useApplicationSettingsStore();

const name = computed(() => props.node.label || props.node.id);
const gpuOnly = computed(() => isGpuOnly(props.node));
const maxServers = computed(
  () => props.context.maxServers?.(props.node) ?? maxServersOf(props.node),
);
const currentBuildId = computed(() => props.context.currentBuildId ?? null);

// Region, build and plugin picks show at once and stay until the
// subscription catches up, or roll back if the save fails.
const optimistic = ref<Partial<Record<OptimisticField, unknown>>>({});
const shown = (field: OptimisticField) =>
  field in optimistic.value
    ? (optimistic.value[field] as any)
    : (props.node[field] ?? null);

watch(
  () => props.node,
  (node) => {
    for (const field of Object.keys(optimistic.value) as OptimisticField[]) {
      if (String(node[field] ?? "") === String(optimistic.value[field] ?? "")) {
        const { [field]: _settled, ...rest } = optimistic.value;
        optimistic.value = rest;
      }
    }
  },
);

// The node as the sections see it, picks included.
const view = computed(() => ({
  ...props.node,
  region: shown("region"),
  pin_build_id: shown("pin_build_id"),
  pin_plugin_version: shown("pin_plugin_version"),
}));

const step = computed(() => nextStep(view.value, props.context));
const attention = computed(() => {
  const items: Array<AttentionItem | { key: "disabled"; tone: "off" }> =
    nodeAttention(view.value, props.context);
  if (!items.length && !props.node.enabled && props.node.status !== "Setup") {
    return [{ key: "disabled" as const, tone: "off" as const }];
  }
  return items;
});
const copyOf = (item: (typeof attention.value)[number]) =>
  item.key === "disabled"
    ? {
        title: t("common.disabled"),
        text: t(`${INSPECTOR}.attention.disabled`),
        url: null,
      }
    : attentionCopy(
        item as AttentionItem,
        t,
        view.value,
        props.gameVersions as any,
      );

const portsOpen = ref(false);
const moreOpen = ref(false);
const logGame = ref<"cs2" | "csgo" | null>(null);
const editVideo = ref(false);

const regionLabel = computed(() => {
  const region = shown("region");
  if (gpuOnly.value) {
    return t("pages.game_server_nodes.gpu_only");
  }
  if (!region) {
    return t("game_server.no_region");
  }
  return (
    props.serverRegions.find((option) => option.value === region)
      ?.description ||
    props.node.e_region?.description ||
    region
  );
});

const statusShort = computed(() => {
  switch (nodeStatus(props.node)) {
    case "setup":
      return t("pages.game_server_nodes.status.setup");
    case "offline":
      return t("common.offline");
    case "disabled":
      return t("common.disabled");
    case "not_accepting":
      return t(`${INSPECTOR}.status.not_accepting`);
    default:
      return "";
  }
});

const STEP_ICON: Record<NextStep, any> = {
  enable: Power,
  retry_update: RotateCw,
  assign_region: Globe,
  set_ports: Network,
  install_cs2: Download,
  change_plugin: Puzzle,
  update_cs2: CircleArrowUp,
  edit_ports: Network,
  open_files: FolderOpen,
};
const stepLabel = (value: NextStep) =>
  value === "install_cs2"
    ? t("game_server.install_cs")
    : value === "update_cs2"
      ? t("game_server.update_cs")
      : t(`${INSPECTOR}.step.${value}`);
const stepIsMenu = computed(
  () => step.value === "assign_region" || step.value === "change_plugin",
);

const pluginRuntime = computed(() => settings.gameServerPluginRuntime);
const csgoShown = computed(
  () => csgoState(view.value, settings.csgoBuildId) !== "none",
);
const runtimePlugins = computed(() =>
  props.pluginVersions.filter(
    (version) => version.runtime === pluginRuntime.value,
  ),
);

const failed = (error: any) =>
  toast({
    variant: "destructive",
    title: t("pages.game_server_nodes.toast.save_failed"),
    description: error?.message,
  });

async function saveOptimistic(
  field: OptimisticField,
  value: unknown,
  _set: Record<string, unknown>,
  title: string,
) {
  optimistic.value = { ...optimistic.value, [field]: value };
  try {
    await setNodeFields(client, props.node.id, _set);
    toast({ title });
  } catch (error: any) {
    const { [field]: _failed, ...rest } = optimistic.value;
    optimistic.value = rest;
    failed(error);
  }
}

const updateRegion = (region: string | null) =>
  saveOptimistic(
    "region",
    region,
    { region },
    t("pages.game_server_nodes.toast.region_updated"),
  );

const pinBuild = (buildId: number | null) =>
  saveOptimistic(
    "pin_build_id",
    buildId,
    { pin_build_id: buildId },
    t("game_server.pinned_build_id"),
  );

// The runtime rides along with the pin: it is half of the plugin_versions
// key, and it keeps the node on that framework across a switch.
const pinPlugin = (version: string | null) =>
  saveOptimistic(
    "pin_plugin_version",
    version,
    {
      pin_plugin_version: version,
      pin_plugin_runtime: version ? pluginRuntime.value : null,
    },
    t("game_server.pinned_plugin_version"),
  );

async function updateCs() {
  try {
    await updateGame(client, props.node.id);
    toast({ title: t("game_server.toast.cs_updating") });
  } catch (error: any) {
    failed(error);
  }
}

async function updateCsgo() {
  try {
    const installed = !!props.node.csgo_build_id;
    await updateGame(client, props.node.id, "csgo");
    toast({
      title: installed
        ? t("game_server.toast.csgo_updating")
        : t("game_server.toast.csgo_installing"),
    });
  } catch (error: any) {
    failed(error);
  }
}

async function savePorts(start: number, end: number) {
  if (
    start === props.node.start_port_range &&
    end === props.node.end_port_range
  ) {
    portsOpen.value = false;
    return;
  }
  try {
    await setNodeFields(client, props.node.id, {
      start_port_range: start,
      end_port_range: end,
    });
    portsOpen.value = false;
    toast({ title: t("game_server.toast.ports_updated") });
  } catch (error: any) {
    failed(error);
  }
}

async function clearPorts() {
  try {
    await setNodeFields(client, props.node.id, {
      start_port_range: null,
      end_port_range: null,
    });
    portsOpen.value = false;
    toast({ title: t("game_server.toast.ports_removed") });
  } catch (error: any) {
    failed(error);
  }
}

async function enable() {
  try {
    await setNodeFields(client, props.node.id, { enabled: true });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.toggle_enabled_failed"),
      description: error?.message,
    });
  }
}

function runStep() {
  switch (step.value) {
    case "enable":
      return enable();
    case "retry_update":
    case "install_cs2":
    case "update_cs2":
      return updateCs();
    case "set_ports":
    case "edit_ports":
      portsOpen.value = true;
      return;
    case "open_files":
      emit("files");
      return;
  }
}

// Rename in place: Enter or leaving the field saves, Esc puts it back.
const renaming = ref(false);
const draft = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
let renameDone = false;

function startRename() {
  draft.value = props.node.label ?? "";
  renameDone = false;
  renaming.value = true;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

async function finishRename(save: boolean) {
  if (renameDone) {
    return;
  }
  renameDone = true;
  renaming.value = false;
  const label = draft.value.trim();
  if (!save || label === (props.node.label ?? "")) {
    return;
  }
  try {
    await setNodeFields(client, props.node.id, { label: label || null });
    toast({ title: t("game_server.toast.label_updated") });
  } catch (error: any) {
    failed(error);
  }
}

function onRenameKey(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    finishRename(true);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    finishRename(false);
  }
}

watch(
  () => props.request,
  (request) => {
    if (!request || request.nodeId !== props.node.id) {
      return;
    }
    if (request.kind === "rename") {
      startRename();
    } else if (!gpuOnly.value) {
      portsOpen.value = true;
    }
  },
  { immediate: true },
);

// The left column sticks under the header, whatever height it wraps to.
const header = ref<HTMLElement | null>(null);
const headerHeight = ref(64);
let headerObserver: ResizeObserver | null = null;
onMounted(() => {
  if (!header.value || typeof ResizeObserver === "undefined") {
    return;
  }
  headerObserver = new ResizeObserver(() => {
    headerHeight.value = header.value?.offsetHeight ?? headerHeight.value;
  });
  headerObserver.observe(header.value);
});
onBeforeUnmount(() => headerObserver?.disconnect());

const CALLOUT_BORDER: Record<string, string> = {
  bad: "border-destructive/30",
  warn: "border-warning/30",
  info: "border-border/60",
  off: "border-border/60",
};
</script>

<template>
  <div :style="{ '--gsn-hdr': `${headerHeight}px` }">
    <header
      ref="header"
      class="sticky top-0 z-[3] grid gap-0.5 border-b border-border bg-[hsl(240_6%_7%)] py-3 pl-4 pr-3"
    >
      <div class="flex min-w-0 items-center gap-2">
        <NodeStatusDot :node="node" side="bottom" />
        <input
          v-if="renaming"
          ref="renameInput"
          v-model="draft"
          class="-ml-1.5 h-[30px] min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :placeholder="t('game_server.label_placeholder')"
          :aria-label="t(`${INSPECTOR}.label`)"
          autocomplete="off"
          spellcheck="false"
          @keydown="onRenameKey"
          @blur="finishRename(true)"
        />
        <button
          v-else
          type="button"
          class="gsn-name"
          :class="!node.label && 'font-mono !text-[13px] !font-medium'"
          :aria-label="t(`${INSPECTOR}.rename`, { node: name })"
          @click="startRename"
        >
          <span class="truncate">{{ name }}</span>
          <Pencil class="gsn-name-pen h-3 w-3 shrink-0" />
        </button>

        <Transition name="gsn-pop" mode="out-in">
          <span v-if="step" :key="step" class="inline-flex shrink-0">
            <DropdownMenu v-if="stepIsMenu">
              <DropdownMenuTrigger as-child>
                <Button size="sm" variant="outline" class="gsn-primary">
                  <component :is="STEP_ICON[step]" class="h-3.5 w-3.5" />
                  {{ stepLabel(step) }}
                  <ChevronDown class="h-3 w-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                class="max-h-72 w-60 overflow-y-auto"
              >
                <template v-if="step === 'assign_region'">
                  <DropdownMenuLabel
                    class="text-xs font-normal text-muted-foreground"
                    >{{ t("common.region") }}</DropdownMenuLabel
                  >
                  <DropdownMenuItem
                    v-for="option of serverRegions"
                    :key="option.value"
                    @click="updateRegion(option.value)"
                  >
                    <span class="flex min-w-0 flex-col">
                      <span class="truncate">{{
                        option.description || option.value
                      }}</span>
                      <span
                        class="font-mono text-[11px] text-muted-foreground"
                        >{{ option.value }}</span
                      >
                    </span>
                  </DropdownMenuItem>
                </template>
                <template v-else>
                  <DropdownMenuLabel
                    class="text-xs font-normal text-muted-foreground"
                    >{{ t("common.plugin_version") }}</DropdownMenuLabel
                  >
                  <DropdownMenuItem @click="pinPlugin(null)">
                    {{ t("game_server.unpin_plugin_version") }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator v-if="runtimePlugins.length" />
                  <DropdownMenuItem
                    v-for="version of runtimePlugins"
                    :key="version.version"
                    @click="pinPlugin(version.version)"
                  >
                    <span class="flex min-w-0 flex-col">
                      <span>{{ version.version }}</span>
                      <span
                        v-if="version.min_game_build_id"
                        class="text-[11px]"
                        :class="
                          Number(node.build_id || 0) >=
                          Number(version.min_game_build_id)
                            ? 'text-success'
                            : TONE_TEXT.warn
                        "
                        >{{ t("game_server.plugin_version_supports") }}
                        {{ version.min_game_build_id }}+</span
                      >
                    </span>
                  </DropdownMenuItem>
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              v-else
              size="sm"
              variant="outline"
              class="gsn-primary"
              :disabled="
                (step === 'install_cs2' ||
                  step === 'update_cs2' ||
                  step === 'retry_update') &&
                !!node.update_status
              "
              @click="runStep"
            >
              <component :is="STEP_ICON[step]" class="h-3.5 w-3.5" />
              {{ stepLabel(step) }}
            </Button>
          </span>
        </Transition>

        <FiveStackToolTip as-child :delay-duration="300" side="bottom">
          <template #trigger>
            <Button
              variant="ghost"
              size="icon-sm"
              class="h-8 w-8 shrink-0 text-muted-foreground"
              :aria-label="t(`${INSPECTOR}.step.open_files`)"
              @click="emit('files')"
            >
              <FolderOpen class="h-4 w-4" />
            </Button>
          </template>
          {{ t(`${INSPECTOR}.step.open_files`) }}
        </FiveStackToolTip>
        <FiveStackToolTip as-child :delay-duration="300" side="left">
          <template #trigger>
            <Button
              variant="ghost"
              size="icon-sm"
              class="h-8 w-8 shrink-0"
              :aria-label="t(`${INSPECTOR}.close`)"
              @click="emit('close')"
            >
              <X class="h-4 w-4" />
            </Button>
          </template>
          {{ t(`${INSPECTOR}.close_hint`) }}
        </FiveStackToolTip>
      </div>
      <div
        class="flex min-w-0 flex-wrap items-center gap-x-1 pl-4 text-xs text-muted-foreground"
      >
        <span class="min-w-0 truncate"
          ><template v-if="statusShort">{{ statusShort }} · </template
          >{{ regionLabel }}</span
        >
        <span
          v-if="node.lan_ip || node.public_ip"
          class="inline-flex shrink-0 items-center gap-x-1"
        >
          <span aria-hidden="true">·</span>
          <a
            v-if="node.lan_ip"
            :href="`http://${node.lan_ip}:8080`"
            target="_blank"
            rel="noopener"
            class="font-mono text-[11.5px] underline decoration-dotted underline-offset-2 hover:text-foreground"
            >{{ node.lan_ip }}</a
          >
          <span v-if="node.lan_ip && node.public_ip" class="opacity-60">/</span>
          <span v-if="node.public_ip" class="font-mono text-[11.5px]">{{
            node.public_ip
          }}</span>
        </span>
      </div>
      <div
        class="flex min-w-0 items-center gap-x-2 pl-4 text-xs text-muted-foreground"
      >
        <span class="inline-flex min-w-0 items-center" :title="node.id">
          <span class="max-w-[9rem] truncate font-mono text-[11.5px]">{{
            node.id
          }}</span>
          <ClipBoard
            :data="node.id"
            class="h-5 w-5 shrink-0 border-transparent bg-transparent [&_svg]:size-3"
            :aria-label="t(`${INSPECTOR}.node.copy_id`)"
          />
        </span>
        <LastChangedFor type="game_server_nodes" :row="node" dot />
      </div>
    </header>

    <div v-if="attention.length" class="px-4 pt-3">
      <div
        class="flex items-start gap-2 rounded-md border bg-[hsl(240_5%_8%)] px-2.5 py-2 text-[12.5px]"
        :class="CALLOUT_BORDER[attention[0].tone]"
        role="status"
      >
        <span class="mt-px" :class="TONE_TEXT[attention[0].tone]">
          <CircleAlert v-if="attention[0].tone === 'bad'" class="h-3.5 w-3.5" />
          <TriangleAlert
            v-else-if="attention[0].tone === 'warn'"
            class="h-3.5 w-3.5"
          />
          <Power v-else-if="attention[0].tone === 'off'" class="h-3.5 w-3.5" />
          <Info v-else class="h-3.5 w-3.5" />
        </span>
        <p class="min-w-0 flex-1">
          <b class="block font-semibold">{{ copyOf(attention[0]).title }}</b>
          <span
            v-if="copyOf(attention[0]).text"
            class="text-muted-foreground"
            >{{ copyOf(attention[0]).text }}</span
          >
          <a
            v-if="copyOf(attention[0]).url"
            :href="copyOf(attention[0]).url!"
            target="_blank"
            rel="noopener"
            class="ml-1 text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
            >{{ t(`${INSPECTOR}.warning.docs`) }}</a
          >
        </p>
        <button
          v-if="attention.length > 1"
          type="button"
          class="-mr-1 inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          :aria-expanded="moreOpen"
          @click="moreOpen = !moreOpen"
        >
          {{ t(`${INSPECTOR}.more`, { count: attention.length - 1 }) }}
          <ChevronDown class="gsn-more-chev h-3 w-3" />
        </button>
      </div>
      <Fold :open="moreOpen && attention.length > 1">
        <ul class="grid gap-1.5 px-0.5 pt-2 text-[12.5px]">
          <li
            v-for="(item, index) of attention.slice(1)"
            :key="`${item.key}-${index}`"
            class="flex items-start gap-2"
          >
            <span class="mt-0.5" :class="TONE_TEXT[item.tone]">
              <CircleAlert v-if="item.tone === 'bad'" class="h-3 w-3" />
              <TriangleAlert v-else-if="item.tone === 'warn'" class="h-3 w-3" />
              <Info v-else class="h-3 w-3" />
            </span>
            <span class="min-w-0">
              <b class="font-semibold">{{ copyOf(item).title }}</b>
              <span v-if="copyOf(item).text" class="text-muted-foreground">
                · {{ copyOf(item).text }}</span
              >
              <a
                v-if="copyOf(item).url"
                :href="copyOf(item).url!"
                target="_blank"
                rel="noopener"
                class="ml-1 text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
                >{{ t(`${INSPECTOR}.warning.docs`) }}</a
              >
            </span>
          </li>
        </ul>
      </Fold>
    </div>

    <div class="gsn-cols">
      <div class="gsn-col gsn-col-l">
        <InspectorLive
          :node="node"
          :stats="stats"
          :range="range"
          @update:range="(value) => emit('update:range', value)"
        />
        <InspectorNode :node="node" part="network" />
        <InspectorDisk
          :node="node"
          :stats="stats"
          :range="range"
          :disk-thresholds="context.diskThresholds!"
          @files="emit('files')"
        />
        <InspectorNode :node="node" class="border-t border-border/60" />
      </div>
      <div class="gsn-col gsn-col-r divide-y divide-border/60">
        <InspectorCapacity
          v-model:ports-open="portsOpen"
          :node="view"
          :region="shown('region')"
          :server-regions="serverRegions"
          :max-servers="maxServers"
          :pinning="pinning"
          @region="updateRegion"
          @save-ports="savePorts"
          @clear-ports="clearPorts"
        />
        <InspectorCs2
          :node="view"
          :game-versions="gameVersions"
          :plugin-versions="pluginVersions"
          :plugin-runtime="pluginRuntime"
          :supports-pinning="settings.supportsGameServerVersionPinning"
          :pin-build="shown('pin_build_id')"
          :pin-plugin="shown('pin_plugin_version')"
          :current-build-id="currentBuildId"
          :next-step="step"
          :csgo-shown="csgoShown"
          @pin-build="pinBuild"
          @pin-plugin="pinPlugin"
          @update-cs="updateCs"
          @install-csgo="updateCsgo"
          @open-log="logGame = 'cs2'"
        />
        <InspectorCsgo
          v-if="csgoShown"
          :node="view"
          :latest-build-id="settings.csgoBuildId"
          @update="updateCsgo"
          @open-log="logGame = 'csgo'"
        />
        <InspectorHardware :node="node" />
        <InspectorGpu
          v-if="node.gpu"
          :node="node"
          :stats="stats"
          @edit-video="editVideo = true"
        />
      </div>
    </div>

    <div
      class="flex items-center gap-3 border-t border-border/60 px-4 pb-4 pt-3.5"
    >
      <p class="min-w-0 flex-1 text-xs text-muted-foreground">
        {{ t(`${INSPECTOR}.remove_text`) }}
      </p>
      <Button
        size="sm"
        variant="outline"
        class="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        @click="emit('remove')"
      >
        <Trash2 class="h-3.5 w-3.5" />
        {{ t(`${INSPECTOR}.remove`) }}
      </Button>
    </div>

    <UpdateLogSheet v-model:game="logGame" :node="node" />

    <EditCs2Options
      v-if="node.gpu"
      :game-server-node="node"
      :open="editVideo"
      @close="editVideo = false"
    />
  </div>
</template>

<style scoped>
.gsn-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.gsn-col {
  min-width: 0;
  container-type: inline-size;
}
.gsn-col-l {
  border-bottom: 1px solid hsl(var(--border) / 0.6);
}
/* The docked aside is the query container; a sheet never splits. */
@container gsn-insp (min-width: 560px) {
  .gsn-cols {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .gsn-col-l {
    position: sticky;
    top: var(--gsn-hdr, 64px);
    align-self: start;
    border-bottom: 0;
  }
  .gsn-col-r {
    border-left: 1px solid hsl(var(--border) / 0.6);
  }
}
.gsn-name {
  display: inline-flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  height: 30px;
  margin-left: -6px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 700;
  text-align: left;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}
.gsn-name:hover {
  border-color: hsl(var(--border));
  background: hsl(240 4% 10%);
}
.gsn-name-pen {
  color: hsl(240 4% 46%);
  opacity: 0;
  transition: opacity 150ms ease;
}
.gsn-name:hover .gsn-name-pen,
.gsn-name:focus-visible .gsn-name-pen {
  opacity: 1;
}
@media (hover: none) {
  .gsn-name-pen {
    opacity: 1;
  }
}
.gsn-primary {
  flex: none;
  gap: 6px;
  border-color: hsl(var(--tac-amber) / 0.55);
  background: hsl(var(--tac-amber) / 0.12);
  color: hsl(var(--tac-amber));
}
.gsn-primary:hover {
  background: hsl(var(--tac-amber) / 0.2);
  color: hsl(var(--tac-amber));
}
.gsn-more-chev {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
[aria-expanded="true"] > .gsn-more-chev {
  transform: rotate(180deg);
}
.gsn-pop-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gsn-pop-leave-active {
  transition: opacity 110ms ease-in;
}
.gsn-pop-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.gsn-pop-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .gsn-more-chev,
  .gsn-pop-enter-active,
  .gsn-pop-leave-active {
    transition: none;
  }
}
</style>
