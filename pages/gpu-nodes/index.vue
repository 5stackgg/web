<script setup lang="ts">
import { getCurrentInstance, ref, watch } from "vue";
import { Plus, Server, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import AdminSearch from "~/components/admin/AdminSearch.vue";
import SortHeader from "~/components/admin/SortHeader.vue";
import StatTile from "~/components/admin/StatTile.vue";
import EditCs2Options from "~/components/game-server-nodes/EditCs2Options.vue";
import GpuNodeRow from "~/components/gpu-nodes/GpuNodeRow.vue";
import GpuNodePanel from "~/components/gpu-nodes/GpuNodePanel.vue";
import GpuRunningRow from "~/components/gpu-nodes/GpuRunningRow.vue";
import GpuSteamAccounts from "~/components/gpu-nodes/GpuSteamAccounts.vue";
import GpuSteamTile from "~/components/gpu-nodes/GpuSteamTile.vue";
import { gpuName, type GpuSession } from "~/components/gpu-nodes/gpuSessions";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import { useGpuNodeActions } from "~/composables/useGpuNodeActions";
import { useListKeyboard } from "~/composables/useListKeyboard";

definePageMeta({
  middleware: "admin",
});

// ↑/↓ walk a table's rows, Enter opens the GPU's panel, Esc closes it. Each
// table keeps its own active row, so only one answers the keys. The rows live
// in the Options half; they are read lazily, after data() exists.
const instance = getCurrentInstance();
const vm = () => instance?.proxy as any;
const activeGpuId = ref<string | null>(null);
const activeSessionId = ref<string | null>(null);
watch(activeGpuId, (id) => {
  if (id) activeSessionId.value = null;
});
watch(activeSessionId, (id) => {
  if (id) activeGpuId.value = null;
});
const closeFromKeys = () => vm()?.closePanelFromKeys() === true;

const gpuKeys = useListKeyboard<any>({
  items: () => vm()?.sortedNodes ?? [],
  getId: (node) => node.id,
  activeId: activeGpuId,
  onOpen: (id) => vm()?.openPanel(id),
  onClose: closeFromKeys,
});
const sessionKeys = useListKeyboard<any>({
  items: () => vm()?.visibleSessions ?? [],
  getId: (session) => session.id,
  activeId: activeSessionId,
  onOpen: (id) => {
    const session = (vm()?.visibleSessions ?? []).find(
      (entry: GpuSession) => entry.id === id,
    );
    if (session) vm()?.openPanel(session.nodeId);
  },
  onClose: closeFromKeys,
});

// The roving tabindex; aria-selected stays the open panel's.
function rowAttrs(keys: typeof gpuKeys, id: string) {
  const { "aria-selected": _selected, ...attrs } = keys.rowProps(id);
  return attrs;
}

const { stopSession } = useGpuNodeActions();

const cs2OptionsNode = ref<any | null>(null);

const stopTarget = ref<GpuSession | null>(null);
async function confirmStop() {
  const target = stopTarget.value;
  if (!target) return;
  await stopSession(target.nodeId);
  stopTarget.value = null;
}

// The Steam account pool's sheet; `add` opens it on the add form.
const accountsOpen = ref(false);
const accountsFocusAdd = ref(false);
function openAccounts(add = false) {
  accountsFocusAdd.value = add;
  accountsOpen.value = true;
}

const tableHead =
  "h-9 whitespace-nowrap px-3 text-left text-xs font-medium text-muted-foreground";

// A sheet opened or closed by a tier change fades in place instead of
// sliding, so the move between aside and sheet reads as a cross-fade.
const sheetFade = {
  "--tw-enter-opacity": "0",
  "--tw-exit-opacity": "0",
  "--tw-enter-translate-x": "0px",
  "--tw-exit-translate-x": "0px",
};
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.gpu_nodes.title") }}</h1>

  <!-- The page caps at 1248px and a GPU's panel docks in the room to its
       right (two columns when there's room for 624px, one at 392px). With
       less room it opens as a sheet. -->
  <div ref="page" class="gpn-page" :data-tier="tier" :data-dock="lastDock">
    <div class="min-w-0">
      <!-- ===================== CONTROL ROW ===================== -->
      <PageTransition :delay="0">
        <div class="flex flex-wrap items-center gap-2">
          <AdminSearch
            v-model="query"
            :placeholder="$t('pages.gpu_nodes.search_placeholder')"
            shortcut
          />
          <AnimatedFilters v-model="kindFilter" :options="kindOptions" square />
          <span class="grow" />
          <FilterMenu
            :count="activeFilterCount"
            :active="activeFilterCount > 0"
            :show-reset="anyFilterActive"
            content-class="w-64 p-2"
            @reset="clearAll"
          >
            <template v-for="group in filterGroups" :key="group.key">
              <p
                class="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground first:pt-0.5"
              >
                {{ group.label }}
              </p>
              <FilterToggle
                v-for="option in group.options"
                :key="option.value"
                :model-value="filters[group.key] === option.value"
                :label="option.label"
                @update:model-value="setFilter(group.key, option.value)"
              />
            </template>
          </FilterMenu>
        </div>
      </PageTransition>

      <!-- ===================== KPI TILES ===================== -->
      <PageTransition :delay="60">
        <div class="mt-5 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <StatTile
            :label="$t('pages.gpu_nodes.kpi.gpus_free')"
            :value="gpusFree"
            :tone="gpuNodes.length && gpusFree === 0 ? 'warn' : undefined"
          >
            <template #aside>{{
              $t("pages.gpu_nodes.kpi.of_total", { total: gpuNodes.length })
            }}</template>
            <template v-if="gpuNodes.length" #sub>
              <span class="flex h-1.5 gap-0.5" aria-hidden="true">
                <span
                  v-for="node in gpuNodes"
                  :key="node.id"
                  class="flex-1 rounded-sm transition-colors duration-150"
                  :class="
                    nodeState(node).group === 'busy'
                      ? 'bg-[hsl(var(--tac-amber))]'
                      : nodeState(node).group === 'off'
                        ? 'bg-muted/50'
                        : 'bg-muted'
                  "
                />
              </span>
            </template>
          </StatTile>

          <GpuSteamTile
            :accounts="steamAccounts"
            :health="health"
            :loaded="accountsLoaded"
            @open="openAccounts"
          />

          <StatTile
            :label="$t('pages.gpu_nodes.kpi.running')"
            :value="kindCounts.live + kindCounts.demo + kindCounts.highlights"
          >
            <template #sub>
              <span class="tabular-nums">{{
                $t("pages.gpu_nodes.kpi.running_split", {
                  live: kindCounts.live,
                  demo: kindCounts.demo,
                  render: kindCounts.highlights,
                })
              }}</span>
            </template>
          </StatTile>

          <StatTile
            :label="$t('pages.gpu_nodes.kpi.waiting')"
            :value="waiting"
            :tone="waiting ? 'warn' : undefined"
          >
            <template #sub>
              <span class="flex flex-wrap gap-x-2">
                <span>{{
                  waiting
                    ? $t(`pages.gpu_nodes.wait_reason.${waitReasonKey}`)
                    : $t("pages.gpu_nodes.kpi.waiting_none")
                }}</span>
                <NuxtLink
                  v-if="waiting"
                  to="/system-render-queue"
                  class="underline decoration-dotted underline-offset-[3px] transition-colors hover:text-[hsl(var(--tac-amber))]"
                >
                  {{ $t("pages.gpu_nodes.open_render_queue") }}
                </NuxtLink>
              </span>
            </template>
          </StatTile>
        </div>
      </PageTransition>

      <!-- ===================== POOL WARNING ===================== -->
      <div
        v-if="
          !loading &&
          accountsLoaded &&
          (health.key === 'empty' || health.key === 'short')
        "
        class="mt-4 flex flex-wrap items-start gap-2.5 rounded-md border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] px-3 py-2.5 text-[13px]"
      >
        <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span class="min-w-[200px] flex-1">
          {{
            health.key === "empty"
              ? $t("pages.gpu_nodes.steam_pool.empty_warning_title")
              : $t("pages.gpu_nodes.steam_pool.short_warning_title", {
                  accounts: health.total,
                  nodes: health.nodes,
                })
          }}
        </span>
        <Button size="sm" variant="outline" @click="openAccounts(true)">
          <Plus class="h-3.5 w-3.5" />
          {{ $t("pages.gpu_nodes.steam_pool.add_title") }}
        </Button>
      </div>

      <!-- ===================== SECTIONS ===================== -->
      <PageTransition :delay="120">
        <div v-if="!loading" class="mt-8 grid gap-8">
          <!-- Running now -->
          <ManageSection
            :label="$t('pages.gpu_nodes.running_title')"
            :hint="$t('pages.gpu_nodes.running_hint')"
          >
            <SectionEmpty
              v-if="!gpuNodes.length"
              class="!min-h-[150px]"
              :title="$t('pages.gpu_nodes.empty.title')"
              :description="$t('pages.gpu_nodes.empty.description')"
            >
              <Button as-child variant="outline" size="sm">
                <NuxtLink to="/game-server-nodes">
                  <Server class="h-3.5 w-3.5" />
                  {{ $t("pages.gpu_nodes.open_game_server_nodes") }}
                </NuxtLink>
              </Button>
            </SectionEmpty>
            <SectionEmpty
              v-else-if="!sessions.length"
              class="!min-h-[130px]"
              :title="$t('pages.gpu_nodes.running_empty_title')"
              :description="$t('pages.gpu_nodes.running_empty_body')"
            />
            <SectionEmpty
              v-else-if="!visibleSessions.length"
              class="!min-h-[130px]"
              :title="$t('pages.gpu_nodes.running_no_match')"
              :description="$t('pages.gpu_nodes.no_match_body')"
            >
              <Button variant="outline" size="sm" @click="clearAll">
                {{ $t("pages.gpu_nodes.clear_all") }}
              </Button>
            </SectionEmpty>
            <div
              v-else
              class="overflow-x-auto rounded-md border border-border bg-card/40"
            >
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-border">
                    <th :class="tableHead">
                      {{ $t("pages.gpu_nodes.col.workload") }}
                    </th>
                    <th :class="tableHead">
                      {{ $t("pages.gpu_nodes.col.for") }}
                    </th>
                    <th :class="tableHead">
                      {{ $t("pages.gpu_nodes.gpu_unknown") }}
                    </th>
                    <th :class="tableHead">
                      {{ $t("pages.gpu_nodes.col.account") }}
                    </th>
                    <th :class="tableHead">
                      {{ $t("pages.gpu_nodes.col.state") }}
                    </th>
                    <th :class="[tableHead, 'text-right']">
                      {{ $t("pages.gpu_nodes.col.time") }}
                    </th>
                    <th :class="tableHead">
                      <span class="sr-only">{{
                        $t("common.actions_label")
                      }}</span>
                    </th>
                  </tr>
                </thead>
                <TransitionGroup
                  tag="tbody"
                  enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
                  enter-from-class="opacity-0 translate-y-1"
                  leave-active-class="transition-opacity [transition-duration:110ms] ease-in"
                  leave-to-class="opacity-0"
                >
                  <GpuRunningRow
                    v-for="session in visibleSessions"
                    :key="session.id"
                    v-bind="rowAttrs(sessionKeys, session.id)"
                    :session="session"
                    :node="nodeById(session.nodeId)"
                    :now="now"
                    :selected="selectedId === session.nodeId"
                    @open="openPanel(session.nodeId)"
                    @stop="stopTarget = session"
                  />
                </TransitionGroup>
              </table>
            </div>
          </ManageSection>

          <!-- GPUs -->
          <ManageSection
            v-if="gpuNodes.length"
            :label="$t('pages.gpu_nodes.gpus_title')"
            :hint="$t('pages.gpu_nodes.gpus_hint')"
          >
            <SectionEmpty
              v-if="!visibleNodes.length"
              class="!min-h-[130px]"
              :title="$t('pages.gpu_nodes.gpus_no_match')"
              :description="$t('pages.gpu_nodes.no_match_body')"
            >
              <Button variant="outline" size="sm" @click="clearAll">
                {{ $t("pages.gpu_nodes.clear_all") }}
              </Button>
            </SectionEmpty>
            <div
              v-else
              class="gpn-gpus overflow-x-auto rounded-md border border-border bg-card/40"
            >
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-border">
                    <SortHeader
                      sort-key="gpu"
                      :label="$t('pages.gpu_nodes.gpu_unknown')"
                      :active="sort"
                      :dir="dir"
                      :class="tableHead"
                      @sort="onSort"
                    />
                    <th :class="tableHead">
                      {{ $t("pages.gpu_nodes.col.workloads") }}
                    </th>
                    <SortHeader
                      sort-key="node"
                      :label="$t('pages.gpu_nodes.col.node')"
                      :active="sort"
                      :dir="dir"
                      :class="tableHead"
                      @sort="onSort"
                    />
                    <SortHeader
                      sort-key="state"
                      :label="$t('pages.gpu_nodes.col.state')"
                      :active="sort"
                      :dir="dir"
                      :class="tableHead"
                      @sort="onSort"
                    />
                    <th :class="tableHead">
                      {{ $t("pages.gpu_nodes.col.load") }}
                    </th>
                    <th :class="tableHead">
                      <span class="sr-only">{{
                        $t("common.actions_label")
                      }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <GpuNodeRow
                    v-for="node in sortedNodes"
                    :key="node.id"
                    v-bind="rowAttrs(gpuKeys, node.id)"
                    :node="node"
                    :state="nodeState(node)"
                    :state-label="stateLabel(node)"
                    :session="sessionByNode[node.id] || null"
                    :selected="selectedId === node.id"
                    @open="openPanel(node.id)"
                    @logs="openPanel(node.id, true)"
                    @video="cs2OptionsNode = node"
                  />
                </tbody>
              </table>
            </div>
          </ManageSection>
        </div>
      </PageTransition>
    </div>

    <Transition :name="tierSwap ? 'gpn-tier' : 'gpn-dock'">
      <aside
        v-if="docked"
        ref="aside"
        class="gpn-insp"
        :aria-label="$t(`${INSPECTOR}.details`)"
      >
        <Transition
          name="gpn-swap"
          mode="out-in"
          @after-leave="resetPanelScroll"
        >
          <GpuNodePanel
            :key="selectedNode.id"
            v-model:logs-open="logsOpen"
            :node="selectedNode"
            :session="sessionByNode[selectedNode.id] || null"
            :bake="bakeByNode[selectedNode.id] || null"
            :state="nodeState(selectedNode)"
            :state-label="stateLabel(selectedNode)"
            @close="closePanel"
            @stop="(session) => (stopTarget = session)"
            @video="cs2OptionsNode = selectedNode"
          />
        </Transition>
      </aside>
    </Transition>
  </div>

  <Sheet :open="sheetOpen" @update:open="(open) => !open && closePanel()">
    <!-- The panel draws its own close in its sticky header, and opening lands
         on the title rather than the first control. -->
    <SheetContent
      side="right"
      class="w-full gap-0 overflow-y-auto overscroll-contain bg-[hsl(240_6%_7%)] p-0 sm:max-w-[460px] [&>button:last-child]:hidden"
      :style="tierSwap ? sheetFade : undefined"
      @open-auto-focus="onSheetAutoFocus"
    >
      <SheetTitle class="sr-only" tabindex="-1" data-gpu-sheet-title>{{
        selectedNode
          ? gpuName(selectedNode) || $t("pages.gpu_nodes.gpu_unknown")
          : $t(`${INSPECTOR}.details`)
      }}</SheetTitle>
      <GpuNodePanel
        v-if="selectedNode"
        v-model:logs-open="logsOpen"
        :node="selectedNode"
        :session="sessionByNode[selectedNode.id] || null"
        :bake="bakeByNode[selectedNode.id] || null"
        :state="nodeState(selectedNode)"
        :state-label="stateLabel(selectedNode)"
        @close="closePanel"
        @stop="(session) => (stopTarget = session)"
        @video="cs2OptionsNode = selectedNode"
      />
    </SheetContent>
  </Sheet>

  <GpuSteamAccounts
    v-model:open="accountsOpen"
    :focus-add="accountsFocusAdd"
    :accounts="steamAccounts"
    :nodes="gpuNodes"
    :health="health"
    :loaded="accountsLoaded"
  />

  <EditCs2Options
    v-if="cs2OptionsNode"
    :game-server-node="cs2OptionsNode"
    :open="cs2OptionsNode !== null"
    @close="cs2OptionsNode = null"
  />

  <AlertDialog
    :open="!!stopTarget"
    @update:open="(open) => !open && (stopTarget = null)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ stopCopy(stopTarget).title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ stopCopy(stopTarget).body }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="gap-2">
        <AlertDialogCancel>{{
          $t("pages.gpu_nodes.stop_copy.keep")
        }}</AlertDialogCancel>
        <!-- Plain button: reka's AlertDialogAction closes (and clears the
             target) before the stop is sent. -->
        <Button variant="destructive" @click="confirmStop">
          {{ stopCopy(stopTarget).action }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { nextSort } from "~/components/admin/sort";
import {
  readRememberedView,
  saveRememberedView,
} from "~/composables/useRememberedView";
import { observeDockTier, type DockTier } from "~/composables/dockTier";
import { useGpuPoolStatusStore } from "~/stores/GpuPoolStatusStore";
import { useRenderQueueStatusStore } from "~/stores/RenderQueueStatusStore";
import {
  buildSessions,
  gpuNodeState,
  gpuViewDefaults,
  gpuViewValidators,
  matchesSearch,
  nodeMatchesFilters,
  poolHealth,
  regionFilterHolds,
  rendersWaiting,
  sortGpuNodes,
  waitReason,
  type GpuNodeFilters,
  type GpuSession as Session,
  type GpuSortKey,
  type GpuView,
} from "~/components/gpu-nodes/gpuSessions";

type FilterKey = keyof GpuNodeFilters;

const VIEW_KEY = "gpu-nodes";

export default {
  data() {
    // The page opens the way it was left: search, filters and sort. Never
    // the open panel; a click decides that.
    const view = readRememberedView<GpuView>(
      VIEW_KEY,
      gpuViewDefaults(),
      gpuViewValidators,
    );
    return {
      loading: true,
      accountsLoaded: false,
      gpuNodes: [] as any[],
      liveStreams: [] as any[],
      demoSessions: [] as any[],
      renderJobs: [] as any[],
      steamAccounts: [] as Array<{
        id: string;
        username: string;
        last_node_id: string | null;
        claims?: Array<{
          purpose: string;
          node_id: string | null;
          k8s_job_name: string;
          created_at: string;
        }>;
      }>,
      query: view.query,
      kindFilter: view.kindFilter,
      filters: view.filters,
      sort: view.sort,
      dir: view.dir,
      // The remembered region is checked against the first GPU list.
      regionChecked: false,
      now: Date.now(),
      ticker: null as ReturnType<typeof setInterval> | null,
      // The GPU whose panel is open, and whether its bake logs are.
      selectedId: null as string | null,
      logsOpen: false,
      tier: "sheet" as DockTier,
      // The docked width the aside keeps, also while it leaves for a sheet.
      lastDock: "docked" as Exclude<DockTier, "sheet">,
      // The panel is moving between aside and sheet: both fade.
      tierSwap: false,
      stopTier: null as (() => void) | null,
    };
  },
  mounted(this: any) {
    // Renders waiting reads the app-wide render queue count (admins already
    // hold this subscription; the call is a no-op when it is running).
    useRenderQueueStatusStore().subscribeToInFlight();
    this.ticker = setInterval(() => {
      this.now = Date.now();
    }, 15 * 1000);
    this.stopTier = observeDockTier(this.$refs.page, this.onTier);
    document.addEventListener("keydown", this.onKeydown);
  },
  beforeUnmount(this: any) {
    if (this.ticker) clearInterval(this.ticker);
    this.stopTier?.();
    document.removeEventListener("keydown", this.onKeydown);
  },
  watch: {
    gpuNodes(this: any, nodes: any[]) {
      if (
        this.selectedId &&
        !nodes.some((node: any) => node.id === this.selectedId)
      ) {
        this.closePanel();
      }
      if (!this.regionChecked && !this.loading) {
        this.regionChecked = true;
        if (!regionFilterHolds(this.filters.region, nodes)) {
          this.filters = { ...this.filters, region: "" };
        }
      }
    },
    viewSignature(this: any) {
      saveRememberedView<GpuView>(
        VIEW_KEY,
        {
          query: this.query,
          kindFilter: this.kindFilter,
          filters: this.filters,
          sort: this.sort,
          dir: this.dir,
        },
        gpuViewDefaults(),
      );
    },
  },
  computed: {
    selectedNode(this: any) {
      return this.nodeById(this.selectedId);
    },
    docked(this: any): boolean {
      return this.tier !== "sheet" && !!this.selectedNode;
    },
    sheetOpen(this: any): boolean {
      return this.tier === "sheet" && !!this.selectedNode;
    },
    sessions(this: any): Session[] {
      return buildSessions({
        nodes: this.gpuNodes,
        streams: this.liveStreams,
        demos: this.demoSessions,
        renders: this.renderJobs,
        accounts: this.steamAccounts,
      });
    },
    sessionByNode(this: any): Record<string, Session> {
      const map: Record<string, Session> = {};
      for (const session of this.sessions as Session[]) {
        if (session.kind !== "bake") map[session.nodeId] = session;
      }
      return map;
    },
    bakeByNode(this: any): Record<string, Session> {
      const map: Record<string, Session> = {};
      for (const session of this.sessions as Session[]) {
        if (session.kind === "bake") map[session.nodeId] = session;
      }
      return map;
    },
    kindCounts(this: any): Record<"live" | "demo" | "highlights", number> {
      const counts = { live: 0, demo: 0, highlights: 0 };
      for (const session of this.sessions as Session[]) {
        if (session.kind !== "bake") counts[session.kind]++;
      }
      return counts;
    },
    kindOptions(this: any) {
      const count = (n: number) => n || undefined;
      return [
        { key: "all", label: this.$t("common.all") },
        {
          key: "live",
          label: this.$t("pages.gpu_nodes.filter.live"),
          count: count(this.kindCounts.live),
        },
        {
          key: "demo",
          label: this.$t("pages.gpu_nodes.filter.demos"),
          count: count(this.kindCounts.demo),
        },
        {
          key: "highlights",
          label: this.$t("pages.gpu_nodes.filter.renders"),
          count: count(this.kindCounts.highlights),
        },
      ];
    },
    visibleSessions(this: any): Session[] {
      return (this.sessions as Session[]).filter((session) => {
        if (this.kindFilter !== "all" && session.kind !== this.kindFilter)
          return false;
        const node = this.nodeById(session.nodeId);
        if (!node) return false;
        return (
          nodeMatchesFilters(node, this.filters) &&
          matchesSearch(this.query, node, session)
        );
      });
    },
    visibleNodes(this: any): any[] {
      return this.gpuNodes.filter(
        (node: any) =>
          nodeMatchesFilters(node, this.filters) &&
          matchesSearch(this.query, node, this.sessionByNode[node.id]),
      );
    },
    sortedNodes(this: any): any[] {
      return sortGpuNodes(this.visibleNodes, this.sort, this.dir, (node) =>
        this.nodeState(node),
      );
    },
    viewSignature(this: any): string {
      return JSON.stringify([
        this.query,
        this.kindFilter,
        this.filters,
        this.sort,
        this.dir,
      ]);
    },
    gpusFree(this: any): number {
      const status = useGpuPoolStatusStore().status;
      if (status) return status.free_gpu_nodes;
      return this.gpuNodes.filter(
        (node: any) => this.nodeState(node).group === "idle",
      ).length;
    },
    health(this: any) {
      return poolHealth(this.gpuNodes, this.steamAccounts);
    },
    waiting(this: any): number {
      return rendersWaiting(
        useRenderQueueStatusStore().queuedCount,
        this.renderJobs,
      );
    },
    waitReasonKey(this: any): string {
      return waitReason({
        nodes: this.gpuNodes,
        sessions: this.sessions,
        accounts: this.steamAccounts,
        pausedForMatch:
          !!useGpuPoolStatusStore().status?.renders_paused_for_active_match,
      });
    },
    filterGroups(this: any) {
      const regions = new Map<string, string>();
      let unassigned = false;
      for (const node of this.gpuNodes) {
        if (node.region) {
          regions.set(node.region, node.e_region?.description || node.region);
        } else {
          unassigned = true;
        }
      }
      return [
        {
          key: "work" as FilterKey,
          label: this.$t("pages.gpu_nodes.filter.workload_on"),
          options: [
            {
              value: "streaming",
              label: this.$t("pages.gpu_nodes.workload.streaming"),
            },
            {
              value: "demos",
              label: this.$t("pages.gpu_nodes.workload.demos"),
            },
            {
              value: "rendering",
              label: this.$t("pages.gpu_nodes.workload.rendering"),
            },
          ],
        },
        {
          key: "kind" as FilterKey,
          label: this.$t("pages.gpu_nodes.filter.node_type"),
          options: [
            { value: "gpu", label: this.$t("pages.gpu_nodes.node_kind.gpu") },
            {
              value: "match",
              label: this.$t("pages.gpu_nodes.node_kind.match"),
            },
          ],
        },
        {
          key: "region" as FilterKey,
          label: this.$t("common.region"),
          options: [
            ...[...regions].map(([value, label]) => ({ value, label })),
            ...(unassigned
              ? [{ value: "none", label: this.$t("pages.gpu_nodes.no_region") }]
              : []),
          ],
        },
      ].filter((group) => group.options.length > 0);
    },
    activeFilterCount(this: any): number {
      return Object.values(this.filters).filter(Boolean).length;
    },
    anyFilterActive(this: any): boolean {
      return (
        this.activeFilterCount > 0 ||
        this.kindFilter !== "all" ||
        this.query.trim().length > 0
      );
    },
  },
  methods: {
    openPanel(this: any, id: string, logs = false) {
      this.tierSwap = false;
      this.logsOpen = logs;
      this.selectedId = id;
    },
    closePanel(this: any) {
      this.tierSwap = false;
      this.selectedId = null;
    },
    // Esc from a table row: true when there was a panel to close.
    closePanelFromKeys(this: any): boolean {
      if (!this.selectedNode) return false;
      this.closePanel();
      return true;
    },
    onSort(this: any, key: string) {
      const next = nextSort<GpuSortKey>(
        { key: this.sort, dir: this.dir },
        key as GpuSortKey,
      );
      this.sort = next.key;
      this.dir = next.dir;
    },
    // The room changed (window, nav or hub): the open panel moves between
    // the aside and the sheet. Wide and narrow docks share the aside, so that
    // switch only reflows it, under a fade.
    onTier(this: any, tier: DockTier) {
      const was = this.tier;
      this.tierSwap = !!this.selectedNode;
      if (tier !== "sheet") {
        this.lastDock = tier;
      }
      this.tier = tier;
      if (this.selectedNode && was !== "sheet" && tier !== "sheet") {
        this.$nextTick(() => {
          const aside = this.$refs.aside as HTMLElement | undefined;
          if (
            aside?.animate &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ) {
            aside.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 240,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            });
          }
        });
      }
    },
    onSheetAutoFocus(event: Event) {
      event.preventDefault();
      (event.target as HTMLElement | null)
        ?.querySelector<HTMLElement>("[data-gpu-sheet-title]")
        ?.focus();
    },
    resetPanelScroll(this: any) {
      const aside = this.$refs.aside as HTMLElement | undefined;
      if (aside) aside.scrollTop = 0;
    },
    onKeydown(this: any, event: KeyboardEvent) {
      if (event.key !== "Escape" || !this.docked || event.defaultPrevented)
        return;
      const target = event.target as HTMLElement;
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable ||
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"]',
        )
      )
        return;
      this.closePanel();
    },
    nodeById(this: any, id: string | null) {
      return this.gpuNodes.find((node: any) => node.id === id) ?? null;
    },
    nodeState(this: any, node: any) {
      return gpuNodeState(node, this.sessionByNode[node.id]);
    },
    stateLabel(this: any, node: any): string {
      const state = this.nodeState(node);
      if (state.key === "offline" && node.offline_at) {
        const at = new Date(node.offline_at);
        const recent = Date.now() - at.getTime() < 18 * 3600 * 1000;
        return this.$t("pages.gpu_nodes.node_state.offline_since", {
          time: recent
            ? at.toLocaleTimeString(dateLocale(), {
                hour: "2-digit",
                minute: "2-digit",
              })
            : at.toLocaleDateString(dateLocale(), {
                month: "short",
                day: "numeric",
              }),
        });
      }
      const shared: Record<string, string> = {
        disabled: "pages.gpu_nodes.disabled",
        offline: "common.offline",
        starting: "pages.gpu_nodes.state.starting",
        rendering: "render_queue_status.rendering",
        bake_failed: "pages.gpu_nodes.bake.stages.errored",
        idle: "pages.gpu_nodes.idle",
      };
      return this.$t(
        shared[state.key] ?? `pages.gpu_nodes.node_state.${state.key}`,
      );
    },
    setFilter(this: any, key: FilterKey, value: string) {
      this.filters[key] = this.filters[key] === value ? "" : value;
    },
    clearAll(this: any) {
      this.query = "";
      this.kindFilter = "all";
      this.filters = { work: "", kind: "", region: "" };
    },
    stopCopy(this: any, session: Session | null) {
      if (!session) return { title: "", body: "", action: "" };
      const who =
        session.who ||
        (session.system
          ? this.$t("common.system")
          : this.$t("gpu_pool_status.unknown_user"));
      if (session.kind === "live") {
        return {
          title: this.$t("pages.gpu_nodes.stop_copy.live_title", {
            matchup: session.matchup || this.$t("gpu_pool_status.live_match"),
          }),
          body: this.$t("pages.gpu_nodes.stop_copy.live_body"),
          action: this.$t("pages.gpu_nodes.stop_copy.live_action"),
        };
      }
      if (session.kind === "demo") {
        return {
          title: this.$t("pages.gpu_nodes.stop_copy.demo_title", { who }),
          body: this.$t("pages.gpu_nodes.stop_copy.demo_body"),
          action: this.$t("pages.gpu_nodes.stop_copy.demo_action"),
        };
      }
      const pct =
        session.status === "rendering" && session.progress !== null
          ? Math.round(session.progress * 100)
          : null;
      return {
        title: this.$t("pages.gpu_nodes.stop_copy.render_title", { who }),
        body:
          pct !== null
            ? this.$t("pages.gpu_nodes.stop_copy.render_body_pct", { pct })
            : this.$t("pages.gpu_nodes.stop_copy.render_body"),
        action: this.$t("pages.gpu_nodes.stop_copy.render_action"),
      };
    },
  },
  apollo: {
    $subscribe: {
      game_server_nodes: {
        query: typedGql("subscription")({
          game_server_nodes: [
            {
              where: { gpu: { _eq: true } } as any,
              order_by: [{ label: "asc" as any }],
            },
            {
              id: true,
              label: true,
              status: true,
              enabled: true,
              enabled_for_match_making: true,
              accepting_new_matches: true,
              region: true,
              gpu: true,
              gpu_info: true,
              gpu_streaming_enabled: true,
              gpu_demos_enabled: true,
              gpu_rendering_enabled: true,
              cs2_video_settings: true,
              public_ip: true,
              lan_ip: true,
              offline_at: true,
              start_port_range: true,
              end_port_range: true,
              disk_used_percent: true,
              disk_available_gb: true,
              shader_bake_status: true,
              shader_bake_progress: true,
              shader_bake_progress_stage: true,
              shader_bake_status_history: true,
              e_region: { description: true },
              e_status: { description: true },
            } as any,
          ],
        }),
        result(this: any, { data }: any) {
          this.gpuNodes = data?.game_server_nodes ?? [];
          this.loading = false;
        },
        error(this: any) {
          this.loading = false;
        },
      },
      match_streams: {
        query: typedGql("subscription")({
          match_streams: [
            {
              where: {
                is_game_streamer: { _eq: true },
                status: { _neq: "errored" },
                game_server_node_id: { _is_null: false },
              } as any,
            },
            {
              id: true,
              match_id: true,
              status: true,
              status_history: true,
              mode: true,
              is_live: true,
              game_server_node_id: true,
              match: {
                id: true,
                lineup_1: { name: true },
                lineup_2: { name: true },
              },
            } as any,
          ],
        } as any),
        result(this: any, { data }: any) {
          this.liveStreams = data?.match_streams ?? [];
        },
      },
      match_demo_sessions: {
        query: typedGql("subscription")({
          match_demo_sessions: [
            {
              where: {
                status: { _neq: "errored" },
                game_server_node_id: { _is_null: false },
              } as any,
            },
            {
              id: true,
              match_id: true,
              status: true,
              status_history: true,
              game_server_node_id: true,
              created_at: true,
              watcher: { steam_id: true, name: true },
              match: {
                id: true,
                lineup_1: { name: true },
                lineup_2: { name: true },
              },
            } as any,
          ],
        } as any),
        result(this: any, { data }: any) {
          this.demoSessions = data?.match_demo_sessions ?? [];
        },
      },
      steam_accounts: {
        query: typedGql("subscription")({
          steam_accounts: [
            { order_by: [{ created_at: "asc" as any }] },
            {
              id: true,
              username: true,
              last_node_id: true,
              claims: [
                {},
                {
                  purpose: true,
                  node_id: true,
                  k8s_job_name: true,
                  created_at: true,
                },
              ],
            },
          ],
        } as any),
        result(this: any, { data }: any) {
          this.steamAccounts = data?.steam_accounts ?? [];
          this.accountsLoaded = true;
        },
      },
      clip_render_jobs: {
        query: typedGql("subscription")({
          clip_render_jobs: [
            {
              where: {
                status: { _in: ["queued", "rendering", "uploading"] },
                game_server_node_id: { _is_null: false },
              } as any,
            },
            {
              id: true,
              status: true,
              progress: true,
              status_history: true,
              game_server_node_id: true,
              user_steam_id: true,
              user: { steam_id: true, name: true },
              match_map: {
                id: true,
                match: {
                  id: true,
                  lineup_1: { name: true },
                  lineup_2: { name: true },
                },
              },
            } as any,
          ],
        } as any),
        result(this: any, { data }: any) {
          this.renderJobs = data?.clip_render_jobs ?? [];
        },
      },
    },
  },
};
</script>

<style scoped>
/* The page runs at the admin width (1280 less padding) and a GPU's panel
   docks in the room to its right, so opening it never squeezes the tables.
   The columns follow the tier only: in a docked tier the room is there
   anyway, and in the sheet tier the aside leaving for the sheet fades out
   past the edge, clipped. */
.gpn-page {
  display: grid;
  grid-template-columns: minmax(0, 1248px) 0px;
  align-items: start;
  overflow-x: clip;
  /* Room for focus rings at the edges, outside the clip. */
  margin-inline: -6px;
  padding-inline: 6px;
}
.gpn-page[data-tier="docked"] {
  grid-template-columns: minmax(0, 1248px) 408px;
}
.gpn-page[data-tier="wide"] {
  grid-template-columns: minmax(0, 1248px) 640px;
}
/* The GPUs table: its workload chips drop their labels when a docked panel
   squeezes it (WorkloadChips). */
.gpn-gpus {
  container: gpn-gpus / inline-size;
}
.gpn-insp {
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
  container: gpn-insp / inline-size;
}
.gpn-page[data-dock="wide"] .gpn-insp {
  width: 624px;
}
.gpn-dock-enter-active {
  animation: gpn-dock-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.gpn-dock-leave-active {
  animation: gpn-dock-out 110ms ease-in both;
}
@keyframes gpn-dock-in {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
}
@keyframes gpn-dock-out {
  to {
    opacity: 0;
    transform: translateX(10px);
  }
}
.gpn-tier-enter-active {
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gpn-tier-leave-active {
  transition: opacity 110ms ease-in;
}
.gpn-tier-enter-from,
.gpn-tier-leave-to {
  opacity: 0;
}
.gpn-swap-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gpn-swap-leave-active {
  transition: opacity 110ms ease-in;
}
.gpn-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.gpn-swap-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .gpn-dock-enter-active,
  .gpn-dock-leave-active {
    animation: none;
  }
  .gpn-tier-enter-active,
  .gpn-tier-leave-active,
  .gpn-swap-enter-active,
  .gpn-swap-leave-active {
    transition: none;
  }
}
</style>
