<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient, useSubscription } from "@vue/apollo-composable";
import NodeTable from "~/components/game-server-nodes/NodeTable.vue";
import NodeInspector from "~/components/game-server-nodes/NodeInspector.vue";
import NodeBulkBar from "~/components/game-server-nodes/NodeBulkBar.vue";
import NodeStatsPoll from "~/components/game-server-nodes/NodeStatsPoll.vue";
import NodeRemoveDialog from "~/components/game-server-nodes/NodeRemoveDialog.vue";
import SetupDialog from "~/components/game-server-nodes/SetupDialog.vue";
import Cs2BuildCard from "~/components/game-server-nodes/Cs2BuildCard.vue";
import AdminSearch from "~/components/admin/AdminSearch.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import DeferredLoading from "~/components/common/DeferredLoading.vue";
import {
  Plus,
  Info,
  Globe,
  ChevronDown,
  Check,
  Activity,
  CircleDot,
  WifiOff,
} from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import { PageTransition, FadeSwap } from "~/components/ui/transitions";
import { toast } from "@/components/ui/toast";
import {
  createButtonClasses,
  listCreateButtonClasses,
  filterTriggerBase,
  filterTriggerIdle,
  filterTriggerActive,
  filterBadgeClasses,
} from "~/utilities/tacticalClasses";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { schemaHasField } from "~/utilities/schemaHasType";
import { order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  filterNodes,
  fleetSummary,
  isReachable,
  maxServers,
  nodeSettings,
  type NodeFilters,
} from "~/components/game-server-nodes/nodeState";
import {
  linkedNodeId,
  needsAttention,
} from "~/components/game-server-nodes/nodeInspector";
import type { MetricRangeKey } from "~/components/game-server-nodes/nodeMetrics";
import { updateGame } from "~/components/game-server-nodes/nodeActions";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import { TONE_TEXT } from "~/components/admin/tone";
import { nextSort, type SortDir } from "~/components/admin/sort";
import { observeDockTier, type DockTier } from "~/composables/dockTier";
import { useBulkSelect } from "~/composables/useBulkSelect";
import { useListKeyboard } from "~/composables/useListKeyboard";
import { useRememberedView } from "~/composables/useRememberedView";

definePageMeta({ middleware: "admin" });

// The fleet is a handful of machines an admin runs, so the page loads all of
// it once and filters, sorts and sums on the client. A row opens the node in
// the inspector docked beside the table, or in a sheet when the room right of
// the capped table is too small (see dockTier). Ticking rows (the checkbox,
// or Cmd/Ctrl- and Shift-click) selects several and the inspector becomes
// the bulk panel. The pick lives in component state only: an in-page query
// key would remount the page. ?node= is read once, on load, as a deep link.

const { t } = useI18n();
const route = useRoute();
const { client } = useApolloClient();
const settingsStore = useApplicationSettingsStore();

const kbdClasses =
  "inline-grid h-[18px] min-w-[18px] place-items-center rounded border border-border px-1 font-mono text-[10.5px] text-muted-foreground";

// A sheet opened or closed by a tier change fades in place instead of
// sliding, so the move between aside and sheet reads as a cross-fade.
const sheetFade = {
  "--tw-enter-opacity": "0",
  "--tw-exit-opacity": "0",
  "--tw-enter-translate-x": "0px",
  "--tw-exit-translate-x": "0px",
};

const page = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
const aside = ref<HTMLElement | null>(null);

// ---- data ----

const versionsSub = useSubscription(
  typedGql("subscription")({
    game_versions: [
      { order_by: [{ updated_at: order_by.desc }] },
      {
        build_id: true,
        version: true,
        description: true,
        updated_at: true,
        current: true,
      },
    ],
  }),
);
const gameVersions = computed<Array<Record<string, any>>>(
  () => (versionsSub.result.value as any)?.game_versions ?? [],
);

const pluginsSub = useSubscription(
  typedGql("subscription")({
    plugin_versions: [
      { order_by: [{ published_at: order_by.desc }] },
      {
        version: true,
        runtime: true,
        min_game_build_id: true,
        published_at: true,
      },
    ],
  }),
);
const pluginVersions = computed<Array<Record<string, any>>>(
  () => (pluginsSub.result.value as any)?.plugin_versions ?? [],
);

const regionsSub = useSubscription(
  typedGql("subscription")({
    server_regions: [{}, { value: true, description: true }],
  }),
);
const serverRegions = computed<Array<{ value: string; description?: string }>>(
  () => (regionsSub.result.value as any)?.server_regions ?? [],
);

// CS:GO's own update columns and a failed update's last log lines come with
// an api that has them; until then the rows go without.
const gameUpdateColumns = ref(false);
schemaHasField(client, "game_server_nodes", "csgo_update_status").then(
  (has) => (gameUpdateColumns.value = has),
);

const nodesSub = useSubscription(() =>
  typedGql("subscription")({
    game_server_nodes: [
      { order_by: [{ label: order_by.asc }, { id: order_by.asc }] },
      {
        id: true,
        label: true,
        status: true,
        region: true,
        enabled: true,
        enabled_for_match_making: true,
        accepting_new_matches: true,
        build_id: true,
        csgo_build_id: true,
        pin_build_id: true,
        pin_plugin_version: true,
        pin_plugin_runtime: true,
        plugin_supported: true,
        lan_ip: true,
        public_ip: true,
        start_port_range: true,
        end_port_range: true,
        supports_low_latency: true,
        supports_cpu_pinning: true,
        update_status: true,
        update_failed_at: true,
        gpu: true,
        gpu_info: true,
        gpu_streaming_enabled: true,
        gpu_demos_enabled: true,
        gpu_rendering_enabled: true,
        shader_bake_status: true,
        cs2_video_settings: true,
        cpu_sockets: true,
        cpu_governor_info: true,
        cpu_frequency_info: true,
        cpu_cores_per_socket: true,
        cpu_threads_per_core: true,
        cpu_warnings: true,
        offline_at: true,
        e_region: {
          description: true,
        },
        e_status: {
          description: true,
        },
        total_server_count: true,
        available_server_count: true,
        demo_network_limiter: true,
        disk_available_gb: true,
        disk_used_percent: true,
        ...(gameUpdateColumns.value
          ? {
              update_error: true,
              csgo_update_status: true,
              csgo_update_failed_at: true,
              csgo_update_error: true,
            }
          : {}),
      } as any,
    ],
  }),
);
const nodes = computed<Array<Record<string, any>>>(
  () => (nodesSub.result.value as any)?.game_server_nodes ?? [],
);
const loading = ref(true);
nodesSub.onResult(() => (loading.value = false));
nodesSub.onError(() => (loading.value = false));

// ---- the view: search, filters, sort and display, as the admin left them ----

const view = useRememberedView(
  "game-server-nodes",
  {
    query: "",
    regions: [] as Array<string>,
    onlyEnabled: false,
    hideOffline: false,
    attentionOnly: false,
    sortDir: "asc" as SortDir,
    displayMetrics: true,
  },
  {
    validate: {
      regions: (value) =>
        Array.isArray(value) &&
        value.every((region) => typeof region === "string"),
      sortDir: (value) => value === "asc" || value === "desc",
    },
  },
);

// A remembered region that no longer exists would hide every node.
watch(serverRegions, (regions) => {
  if (!regions.length || !view.regions.length) {
    return;
  }
  const known = new Set(regions.map((region) => region.value));
  const kept = view.regions.filter((region) => known.has(region));
  if (kept.length !== view.regions.length) {
    view.regions = kept;
  }
});

const currentGameVersion = computed(() =>
  gameVersions.value.find((version) => version.current === true),
);
const supportsGameServerNodes = computed(
  () => settingsStore.supportsGameServerNodes,
);
const settings = computed(() => nodeSettings(settingsStore.settings));
const pinning = computed(() => settings.value.pinning);
const issueContext = computed(() => ({
  currentBuildId: currentGameVersion.value?.build_id ?? null,
  maxServers: (node: any) => maxServers(node, settings.value.pinning),
  diskThresholds: settings.value.disk,
}));
const summary = computed(() =>
  fleetSummary(nodes.value as any, issueContext.value),
);

const scopeOptions = computed(() => [
  { key: "all", label: t("common.all") },
  {
    key: "attention",
    label: t("pages.system_metrics.scope_attention"),
    count: summary.value.attention || undefined,
  },
]);

const filters = computed<NodeFilters>(() => ({
  query: view.query,
  regions: view.regions,
  onlyEnabled: view.onlyEnabled,
  hideOffline: view.hideOffline,
  sort: view.sortDir,
}));

const visibleNodes = computed<Array<Record<string, any>>>(() => {
  const shown = filterNodes(nodes.value as any, filters.value);
  return view.attentionOnly
    ? shown.filter((node) => needsAttention(node, issueContext.value))
    : shown;
});

const optionsActiveCount = computed(
  () => (view.onlyEnabled ? 1 : 0) + (view.hideOffline ? 1 : 0),
);
const hasActiveFilters = computed(
  () =>
    view.query !== "" ||
    view.regions.length > 0 ||
    view.onlyEnabled ||
    view.hideOffline ||
    view.attentionOnly ||
    view.sortDir !== "asc",
);

function resetFilters() {
  view.query = "";
  view.regions = [];
  view.onlyEnabled = false;
  view.hideOffline = false;
  view.attentionOnly = false;
  view.sortDir = "asc";
}

function toggleRegion(value: string) {
  view.regions = view.regions.includes(value)
    ? view.regions.filter((region) => region !== value)
    : [...view.regions, value];
}

function onSort(key: string) {
  view.sortDir = nextSort({ key: "node", dir: view.sortDir }, key).dir;
}

// ---- live stats ----

const nodeStats = shallowRef<Record<string, any>>({});
function onStats(id: string, stats: any) {
  nodeStats.value = {
    ...nodeStats.value,
    [id]: stats ? Object.freeze(stats) : null,
  };
}

// ---- the inspector and the selection ----

const pickedId = ref<string | null>(null);
const swapAnimate = ref(true);
const edgeGlide = ref(false);
const tier = ref<DockTier>("sheet");
// The docked width the aside keeps, also while it leaves for a sheet.
const lastDock = ref<Exclude<DockTier, "sheet">>("docked");
// The panel is moving between aside and sheet: both fade.
const tierSwap = ref(false);
const metricsRange = ref<MetricRangeKey>("live");
const request = ref<{
  nodeId: string;
  kind: "rename" | "ports";
  n: number;
} | null>(null);
const removeTarget = ref<Record<string, any> | null>(null);
const removeOpen = ref(false);
const setupGameServer = ref<Record<string, any> | null>(null);
const showSetupDialog = ref(false);
const modifierKey = ref("Ctrl");

// Rows that leave the list leave the selection, so bulk actions only reach
// rows the admin can see.
const bulk = useBulkSelect({
  items: visibleNodes,
  getId: (node) => node.id,
  escape: false,
});
const multiIds = computed(() => [...bulk.selected.value]);
const isMulti = computed(() => bulk.count.value > 1);
const selectedNodes = bulk.selectedItems;

const pickedNode = computed(
  () => nodes.value.find((node) => node.id === pickedId.value) ?? null,
);
const inspecting = computed(() => isMulti.value || !!pickedNode.value);
const docked = computed(() => tier.value !== "sheet" && inspecting.value);
const sheetOpen = computed(() => tier.value === "sheet" && inspecting.value);

// CPU and memory for every row that shows load; the inspected node gets the
// full set (disks, network, GPUs) for its Live section.
const polls = computed(() => {
  const inspected =
    !isMulti.value && pickedNode.value?.status !== "Setup"
      ? pickedId.value
      : null;
  const ids = view.displayMetrics
    ? visibleNodes.value
        .filter((node) => isReachable(node as any))
        .map((node) => node.id)
    : [];
  if (inspected && !ids.includes(inspected)) {
    ids.push(inspected);
  }
  return ids.map((id) => ({ id, full: id === inspected }));
});

function pick(
  id: string,
  { kbd = false, instant = false, wasMulti = isMulti.value } = {},
) {
  tierSwap.value = false;
  const opening = !inspecting.value;
  if (pickedId.value === id && !wasMulti) {
    return;
  }
  // A rename or ports request belongs to the node it was made on.
  request.value = null;
  swapAnimate.value = !kbd && !instant;
  edgeGlide.value = !kbd && !instant && !opening && !wasMulti;
  pickedId.value = id;
}

// The selection drives the panel: two or more rows is the bulk panel, one
// row is that node's inspector, and clearing a bulk selection closes it.
// Sync, so openNode and closeInspector can clear it without the follow-up.
let quiet = false;
function quietly(change: () => void) {
  quiet = true;
  try {
    change();
  } finally {
    quiet = false;
  }
}
watch(
  bulk.selected,
  (next, prev) => {
    if (quiet) {
      return;
    }
    if (next.size === 1 && prev.size !== 1) {
      pick([...next][0], { wasMulti: prev.size > 1 });
    } else if (next.size === 0 && prev.size > 1) {
      closeInspector();
    } else if (next.size > 1 && prev.size < 2) {
      tierSwap.value = false;
      request.value = null;
      swapAnimate.value = true;
    }
  },
  { flush: "sync" },
);

// One node, opened by a click, Enter or its menu: leaves any selection.
function openNode(
  id: string,
  options: { kbd?: boolean; instant?: boolean } = {},
) {
  const wasMulti = isMulti.value;
  quietly(() => bulk.clear());
  pick(id, { ...options, wasMulti });
}

// A selection started while a node is open takes that node along.
function seedSelection(id: string) {
  const open = pickedId.value;
  if (
    !bulk.count.value &&
    open &&
    open !== id &&
    visibleNodes.value.some((node) => node.id === open)
  ) {
    bulk.toggle(open, true);
  }
}

function onRowPick(id: string, event: MouseEvent | KeyboardEvent) {
  if (
    event instanceof MouseEvent &&
    (event.metaKey || event.ctrlKey || event.shiftKey)
  ) {
    seedSelection(id);
    bulk.onRowClick(id, event);
    return;
  }
  openNode(id, { kbd: event instanceof KeyboardEvent });
}

function onRowSelect(id: string, event: MouseEvent) {
  seedSelection(id);
  bulk.onCheckbox(id, event);
}

function unpick(id: string) {
  bulk.toggle(id, false);
}

function rowElement(id: string): HTMLElement | null {
  return (
    list.value?.querySelector<HTMLElement>(
      `tr[data-node="${CSS.escape(id)}"]`,
    ) ?? null
  );
}

function closeInspector() {
  const was = pickedId.value;
  const hadFocus = !!aside.value?.contains(document.activeElement);
  tierSwap.value = false;
  quietly(() => bulk.clear());
  pickedId.value = null;
  if (hadFocus && was) {
    nextTick(() => rowElement(was)?.focus({ preventScroll: true }));
  }
}

function resetInspectorScroll() {
  if (aside.value) {
    aside.value.scrollTop = 0;
  }
}

function onSheetAutoFocus(event: Event) {
  event.preventDefault();
  (event.target as HTMLElement | null)
    ?.querySelector<HTMLElement>("[data-node-sheet-title]")
    ?.focus();
}

watch(nodes, (all) => {
  if (pickedId.value && !all.some((node) => node.id === pickedId.value)) {
    pickedId.value = null;
  }
  readLink();
});

// ---- keyboard: ↑/↓ walk the rows (the open inspector follows), Enter opens,
// Esc closes. The page is the list, so the keys work from the inspector too.

const activeNodeId = ref<string | null>(null);
const keyboardRow = computed<string | null>({
  get: () => activeNodeId.value ?? pickedId.value,
  set: (id) => {
    activeNodeId.value = id;
    if (id && pickedNode.value && !isMulti.value) {
      pick(id, { kbd: true });
    }
  },
});
const listKeys = useListKeyboard({
  items: visibleNodes,
  getId: (node) => node.id,
  activeId: keyboardRow,
  container: page,
  onOpen: (id) => openNode(id, { kbd: true }),
  onClose: () => {
    if (!inspecting.value) {
      return false;
    }
    closeInspector();
    return true;
  },
});

// The row's own focus marks it active without moving the inspector: a click
// opens the node itself. aria-selected stays the pick's.
function rowAttrs(id: string) {
  const {
    "aria-selected": _selected,
    onFocus: _focus,
    ...attrs
  } = listKeys.rowProps(id);
  return {
    ...attrs,
    onFocus: (event: FocusEvent) => {
      if (event.target === event.currentTarget) {
        activeNodeId.value = id;
      }
    },
  };
}

// ---- row actions ----

async function onRowAction(action: string, id: string) {
  const node = nodes.value.find((entry) => entry.id === id);
  if (!node) {
    return;
  }
  switch (action) {
    case "open":
      openNode(id);
      return;
    case "select":
      seedSelection(id);
      bulk.toggle(id);
      return;
    case "rename":
    case "ports":
      openNode(id, { instant: true });
      request.value = {
        nodeId: id,
        kind: action,
        n: (request.value?.n ?? 0) + 1,
      };
      return;
    case "files":
      openFiles(id);
      return;
    case "remove":
      askRemove(id);
      return;
    case "update":
      try {
        await updateGame(client, id);
        toast({ title: t("game_server.toast.cs_updating") });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: t("pages.game_server_nodes.toast.save_failed"),
          description: error?.message,
        });
      }
  }
}

function openFiles(id: string) {
  useFilePopout().openFiles({ scope: "node", id });
}

function askRemove(id: string) {
  removeTarget.value = nodes.value.find((node) => node.id === id) ?? null;
  removeOpen.value = !!removeTarget.value;
}

// A deep link from another page (/game-server-nodes?node=<id>), read once the
// nodes have arrived. Never written back: the query key would remount the
// page. The remembered view never restores a pick; the link or a click does.
let linkRead = false;
function readLink() {
  if (linkRead || !nodes.value.length) {
    return;
  }
  linkRead = true;
  const id = linkedNodeId(route.query.node, nodes.value as any);
  if (!id) {
    return;
  }
  if (!visibleNodes.value.some((node) => node.id === id)) {
    resetFilters();
  }
  pick(id, { instant: true });
  nextTick(() =>
    requestAnimationFrame(() =>
      rowElement(id)?.scrollIntoView({ block: "center" }),
    ),
  );
}

// The room changed (window, nav or hub): the open panel moves between the
// aside and the sheet, keeping its pick and range. Wide and narrow docks
// share the aside, so that switch only reflows it, under a fade.
function onTier(next: DockTier) {
  const was = tier.value;
  tierSwap.value = inspecting.value;
  // A remounted inspector would replay it.
  request.value = null;
  if (next !== "sheet") {
    lastDock.value = next;
  }
  tier.value = next;
  if (inspecting.value && was !== "sheet" && next !== "sheet") {
    nextTick(() => {
      if (
        aside.value?.animate &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        aside.value.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 240,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        });
      }
    });
  }
}

async function createGameServerNode() {
  const { data } = await client.mutate({
    mutation: generateMutation({
      setupGameServer: {
        link: true,
        gameServerId: true,
      },
    }),
  });
  setupGameServer.value = data.setupGameServer;
  showSetupDialog.value = true;
}

function closeSetupDialog() {
  showSetupDialog.value = false;
  setTimeout(() => {
    setupGameServer.value = null;
  }, 300);
}

let stopTier: (() => void) | null = null;
onMounted(() => {
  modifierKey.value = /Mac|iP/.test(navigator.platform || "") ? "⌘" : "Ctrl";
  if (page.value) {
    stopTier = observeDockTier(page.value, onTier);
  }
});
onBeforeUnmount(() => stopTier?.());
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.game_server_nodes.title") }}</h1>

  <NodeStatsPoll
    v-for="poll of polls"
    :key="`${poll.id}:${poll.full ? 'full' : 'slim'}`"
    :node-id="poll.id"
    :full="poll.full"
    @stats="onStats"
  />

  <!-- The inspector docks in the room right of the capped page (two columns
       when there's room for 624px, one at 392px) and runs the full height of
       the column, from the top. With less room it opens as a sheet. -->
  <div ref="page" class="gsn-page" :data-tier="tier" :data-dock="lastDock">
    <div class="min-w-0">
      <PageTransition v-if="currentGameVersion" :delay="0" class="gsn-cap">
        <Cs2BuildCard :current-version="currentGameVersion" />
      </PageTransition>

      <PageTransition
        v-if="!supportsGameServerNodes"
        :delay="40"
        class="gsn-cap mt-4"
      >
        <div
          class="flex items-start gap-3 rounded-md border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] px-4 py-3 text-sm"
        >
          <Info class="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div class="space-y-0.5">
            <p class="font-semibold">
              {{ $t("pages.game_server_nodes.not_supported.title") }}
            </p>
            <p class="text-muted-foreground">
              {{ $t("pages.game_server_nodes.not_supported.description") }}
              <a
                target="_blank"
                rel="noopener"
                class="underline underline-offset-2 hover:text-foreground"
                href="https://docs.5stack.gg/servers/game-server-nodes/"
                >{{ $t("layouts.app_nav.administration.game_server_nodes") }}</a
              >.
            </p>
          </div>
        </div>
      </PageTransition>

      <PageTransition :delay="80" class="mt-4">
        <DeferredLoading :loading="loading" v-slot="{ skeleton }">
          <FadeSwap>
            <div
              v-if="skeleton"
              key="loading"
              class="gsn-cap space-y-3"
              aria-busy="true"
            >
              <Skeleton class="h-8 w-full max-w-xs rounded-md" />
              <Skeleton class="h-4 w-64 rounded" />
              <Skeleton class="h-[14rem] w-full rounded-md" />
            </div>

            <SectionEmpty
              v-else-if="nodes.length === 0"
              key="empty"
              class="gsn-cap"
              :title="$t('pages.game_server_nodes.empty.title')"
              :description="$t('pages.game_server_nodes.empty.description')"
            >
              <Button
                v-if="supportsGameServerNodes"
                size="sm"
                :class="createButtonClasses"
                @click="createGameServerNode"
              >
                <Plus class="h-4 w-4" />
                {{ $t("pages.game_server_nodes.create_node") }}
              </Button>
              <Button as-child variant="ghost" size="sm">
                <a
                  href="https://docs.5stack.gg/servers/game-server-nodes/"
                  target="_blank"
                  rel="noopener"
                  >{{ $t("pages.game_server_nodes.empty.guide") }}</a
                >
              </Button>
            </SectionEmpty>

            <div v-else key="nodes" class="grid gap-2.5">
              <!-- Control row -->
              <div class="gsn-cap flex flex-wrap items-center gap-2">
                <AdminSearch
                  v-model="view.query"
                  :placeholder="$t(`${INSPECTOR}.search_placeholder`)"
                  shortcut
                />

                <AnimatedFilters
                  :model-value="view.attentionOnly ? 'attention' : 'all'"
                  square
                  :options="scopeOptions"
                  @update:model-value="
                    (value) => (view.attentionOnly = value === 'attention')
                  "
                />

                <Popover>
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      :class="[
                        filterTriggerBase,
                        view.regions.length
                          ? filterTriggerActive
                          : filterTriggerIdle,
                      ]"
                    >
                      <Globe class="h-3.5 w-3.5" />
                      {{ $t("common.region") }}
                      <span
                        v-if="view.regions.length"
                        :class="filterBadgeClasses"
                      >
                        {{ view.regions.length }}
                      </span>
                      <ChevronDown class="h-3 w-3 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    class="max-h-72 w-56 space-y-0.5 overflow-y-auto p-2"
                  >
                    <span
                      class="block px-1 pb-1 text-[11px] text-muted-foreground"
                    >
                      {{ $t("pages.manage_matches.filter_by_regions") }}
                    </span>
                    <button
                      v-for="region in serverRegions"
                      :key="region.value"
                      type="button"
                      class="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
                      :class="
                        view.regions.includes(region.value)
                          ? 'text-[hsl(var(--tac-amber))]'
                          : 'text-foreground/90'
                      "
                      @click="toggleRegion(region.value)"
                    >
                      <span>{{ region.description || region.value }}</span>
                      <Check
                        v-if="view.regions.includes(region.value)"
                        class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
                      />
                    </button>
                  </PopoverContent>
                </Popover>

                <span class="grow"></span>

                <FilterMenu
                  :count="optionsActiveCount"
                  :active="optionsActiveCount > 0"
                  :show-reset="hasActiveFilters"
                  content-class="w-60 space-y-0.5 p-2"
                  @reset="resetFilters"
                >
                  <FilterToggle
                    :model-value="view.onlyEnabled"
                    :label="$t('pages.game_server_nodes.filters.only_enabled')"
                    @update:model-value="(value) => (view.onlyEnabled = value)"
                  >
                    <template #icon><CircleDot class="h-3.5 w-3.5" /></template>
                  </FilterToggle>
                  <FilterToggle
                    :model-value="view.hideOffline"
                    :label="$t('pages.game_server_nodes.filters.hide_offline')"
                    @update:model-value="(value) => (view.hideOffline = value)"
                  >
                    <template #icon><WifiOff class="h-3.5 w-3.5" /></template>
                  </FilterToggle>
                  <div class="!my-1.5 h-px bg-border" aria-hidden="true"></div>
                  <span
                    class="block px-2 pb-0.5 text-[11px] text-muted-foreground"
                    >{{ $t("common.view") }}</span
                  >
                  <FilterToggle
                    :model-value="view.displayMetrics"
                    :label="
                      $t('pages.game_server_nodes.filters.display_metrics')
                    "
                    @update:model-value="
                      (value) => (view.displayMetrics = value)
                    "
                  >
                    <template #icon><Activity class="h-3.5 w-3.5" /></template>
                  </FilterToggle>
                </FilterMenu>

                <Button
                  size="sm"
                  :class="listCreateButtonClasses"
                  :disabled="!supportsGameServerNodes"
                  :title="$t('pages.game_server_nodes.create_node')"
                  @click="createGameServerNode"
                >
                  <Plus class="h-4 w-4" />
                  <span class="max-md:sr-only">{{
                    $t("pages.game_server_nodes.create_node")
                  }}</span>
                </Button>
              </div>

              <!-- Fleet summary -->
              <div
                class="gsn-cap flex min-h-5 flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-muted-foreground"
              >
                <i18n-t
                  keypath="pages.game_server_nodes.summary.nodes"
                  :plural="summary.total"
                  tag="span"
                  scope="global"
                >
                  <template #count>
                    <b class="font-semibold tabular-nums text-foreground">{{
                      summary.total
                    }}</b>
                  </template>
                </i18n-t>
                <i18n-t
                  keypath="pages.game_server_nodes.summary.online"
                  tag="span"
                  scope="global"
                >
                  <template #count>
                    <b class="font-semibold tabular-nums text-foreground">{{
                      summary.online
                    }}</b>
                  </template>
                </i18n-t>
                <i18n-t
                  v-if="summary.capacity > 0"
                  keypath="pages.game_server_nodes.summary.free"
                  tag="span"
                  scope="global"
                >
                  <template #free>
                    <b class="font-semibold tabular-nums text-foreground">{{
                      summary.free
                    }}</b>
                  </template>
                  <template #total>
                    <span class="tabular-nums">{{ summary.capacity }}</span>
                  </template>
                </i18n-t>
                <span
                  v-if="summary.attention > 0"
                  class="tabular-nums"
                  :class="TONE_TEXT.warn"
                  >{{
                    $t(
                      "pages.game_server_nodes.summary.attention",
                      { count: summary.attention },
                      summary.attention,
                    )
                  }}</span
                >
                <span
                  v-if="summary.updating > 0"
                  class="tabular-nums text-info"
                  >{{
                    $t("pages.game_server_nodes.summary.updating", {
                      count: summary.updating,
                    })
                  }}</span
                >
                <span
                  class="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground/60 min-[1100px]:inline-flex"
                >
                  <template v-if="docked">
                    <span :class="kbdClasses">↑</span
                    ><span :class="kbdClasses">↓</span>
                    {{ $t(`${INSPECTOR}.keys.move`) }}
                    <span :class="kbdClasses" class="ml-2">{{
                      modifierKey
                    }}</span>
                    {{ $t(`${INSPECTOR}.keys.select`) }}
                    <span :class="kbdClasses" class="ml-2">Esc</span>
                    {{ $t(`${INSPECTOR}.keys.close`) }}
                  </template>
                  <template v-else>{{ $t(`${INSPECTOR}.keys.idle`) }}</template>
                </span>
              </div>

              <div class="gsn-split">
                <div ref="list" class="min-w-0">
                  <FadeSwap>
                    <NodeTable
                      v-if="visibleNodes.length"
                      key="table"
                      :nodes="visibleNodes"
                      :picked-id="pickedId"
                      :multi-ids="multiIds"
                      :edge-glide="edgeGlide"
                      :sort="view.sortDir"
                      :row-attrs="rowAttrs"
                      :game-versions="gameVersions"
                      :context="issueContext"
                      :disk-thresholds="issueContext.diskThresholds"
                      :stats="nodeStats"
                      :show-load="view.displayMetrics"
                      @pick="onRowPick"
                      @select="onRowSelect"
                      @action="onRowAction"
                      @sort="onSort"
                    />

                    <SectionEmpty
                      v-else
                      key="no-match"
                      :title="$t('common.empty_filtered.title')"
                      :description="$t('common.empty_filtered.description')"
                    >
                      <Button variant="outline" size="sm" @click="resetFilters">
                        {{ $t("common.reset_filters") }}
                      </Button>
                    </SectionEmpty>
                  </FadeSwap>
                </div>
              </div>
            </div>
          </FadeSwap>
        </DeferredLoading>
      </PageTransition>
    </div>

    <Transition :name="tierSwap ? 'gsn-tier' : 'gsn-dock'">
      <aside
        v-if="docked"
        ref="aside"
        class="gsn-insp"
        :aria-label="$t(`${INSPECTOR}.details`)"
      >
        <Transition
          :css="swapAnimate"
          name="gsn-swap"
          mode="out-in"
          @after-leave="resetInspectorScroll"
        >
          <NodeBulkBar
            v-if="isMulti"
            key="bulk"
            :nodes="selectedNodes"
            :regions="serverRegions"
            :current-build-id="currentGameVersion?.build_id"
            :game-versions="gameVersions"
            @clear="closeInspector"
            @unpick="unpick"
          />
          <NodeInspector
            v-else-if="pickedNode"
            :key="pickedNode.id"
            :node="pickedNode"
            :game-versions="gameVersions"
            :plugin-versions="pluginVersions"
            :server-regions="serverRegions"
            :context="issueContext"
            :pinning="pinning"
            :stats="nodeStats[pickedNode.id]"
            :range="metricsRange"
            :request="request"
            @update:range="(value) => (metricsRange = value)"
            @close="closeInspector"
            @remove="askRemove(pickedNode.id)"
            @files="openFiles(pickedNode.id)"
          />
        </Transition>
      </aside>
    </Transition>
  </div>

  <Sheet :open="sheetOpen" @update:open="(open) => !open && closeInspector()">
    <!-- The panels draw their own close in the sticky header (the sheet's
         would sit hidden under it), and opening lands on the title rather
         than the rename button. -->
    <SheetContent
      side="right"
      class="w-full gap-0 overflow-y-auto overscroll-contain bg-[hsl(240_6%_7%)] p-0 sm:max-w-[460px] [&>button:last-child]:hidden"
      :style="tierSwap ? sheetFade : undefined"
      @open-auto-focus="onSheetAutoFocus"
    >
      <SheetTitle class="sr-only" tabindex="-1" data-node-sheet-title>{{
        pickedNode
          ? pickedNode.label || pickedNode.id
          : $t(`${INSPECTOR}.details`)
      }}</SheetTitle>
      <NodeBulkBar
        v-if="isMulti"
        :nodes="selectedNodes"
        :regions="serverRegions"
        :current-build-id="currentGameVersion?.build_id"
        :game-versions="gameVersions"
        @clear="closeInspector"
        @unpick="unpick"
      />
      <NodeInspector
        v-else-if="pickedNode"
        :key="pickedNode.id"
        :node="pickedNode"
        :game-versions="gameVersions"
        :plugin-versions="pluginVersions"
        :server-regions="serverRegions"
        :context="issueContext"
        :pinning="pinning"
        :stats="nodeStats[pickedNode.id]"
        :range="metricsRange"
        :request="request"
        @update:range="(value) => (metricsRange = value)"
        @close="closeInspector"
        @remove="askRemove(pickedNode.id)"
        @files="openFiles(pickedNode.id)"
      />
    </SheetContent>
  </Sheet>

  <NodeRemoveDialog
    :node="removeTarget"
    :open="removeOpen"
    @update:open="(open) => (removeOpen = open)"
  />

  <SetupDialog
    v-if="setupGameServer"
    :open="showSetupDialog"
    :setup-game-server="setupGameServer"
    @close="closeSetupDialog"
  />
</template>

<style scoped>
/* The page runs at the admin width (1280 less padding) and the inspector
   docks in the room to its right, so opening it never squeezes the table.
   The columns follow the tier only, not whether the panel is open: in a
   docked tier the room is there anyway, and in the sheet tier the aside
   leaving for the sheet fades out past the edge, clipped. */
.gsn-cap {
  max-width: 1248px;
}
.gsn-page {
  display: grid;
  grid-template-columns: minmax(0, 1248px) 0px;
  align-items: start;
  overflow-x: clip;
  /* Room for focus rings at the edges, outside the clip. */
  margin-inline: -6px;
  padding-inline: 6px;
}
.gsn-page[data-tier="docked"] {
  grid-template-columns: minmax(0, 1248px) 408px;
}
.gsn-page[data-tier="wide"] {
  grid-template-columns: minmax(0, 1248px) 640px;
}
.gsn-insp {
  position: sticky;
  top: 0.5rem;
  width: 392px;
  max-height: calc(100dvh - 6rem);
  margin-left: 16px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  background: hsl(240 6% 7%);
  scrollbar-width: thin;
  scrollbar-color: #27272a transparent;
  container: gsn-insp / inline-size;
}
.gsn-page[data-dock="wide"] .gsn-insp {
  width: 624px;
}
.gsn-dock-enter-active {
  animation: gsn-dock-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.gsn-dock-leave-active {
  animation: gsn-dock-out 110ms ease-in both;
}
@keyframes gsn-dock-in {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
}
@keyframes gsn-dock-out {
  to {
    opacity: 0;
    transform: translateX(10px);
  }
}
.gsn-tier-enter-active {
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gsn-tier-leave-active {
  transition: opacity 110ms ease-in;
}
.gsn-tier-enter-from,
.gsn-tier-leave-to {
  opacity: 0;
}
.gsn-swap-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gsn-swap-leave-active {
  transition: opacity 110ms ease-in;
}
.gsn-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.gsn-swap-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .gsn-dock-enter-active,
  .gsn-dock-leave-active {
    animation: none;
  }
  .gsn-tier-enter-active,
  .gsn-tier-leave-active,
  .gsn-swap-enter-active,
  .gsn-swap-leave-active {
    transition: none;
  }
}
</style>
