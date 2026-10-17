<script setup lang="ts">
import NodeTable from "~/components/game-server-nodes/NodeTable.vue";
import NodeInspector from "~/components/game-server-nodes/NodeInspector.vue";
import NodeBulkBar from "~/components/game-server-nodes/NodeBulkBar.vue";
import NodeStatsPoll from "~/components/game-server-nodes/NodeStatsPoll.vue";
import NodeRemoveDialog from "~/components/game-server-nodes/NodeRemoveDialog.vue";
import SetupDialog from "~/components/game-server-nodes/SetupDialog.vue";
import Cs2BuildCard from "~/components/game-server-nodes/Cs2BuildCard.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import DeferredLoading from "~/components/common/DeferredLoading.vue";
import {
  Plus,
  Info,
  Search,
  X,
  Globe,
  ChevronDown,
  Check,
  Activity,
  CircleDot,
  WifiOff,
} from "lucide-vue-next";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import { PageTransition, FadeSwap } from "~/components/ui/transitions";
import {
  createButtonClasses,
  listCreateButtonClasses,
  filterTriggerBase,
  filterTriggerIdle,
  filterTriggerActive,
  filterBadgeClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({ middleware: "admin" });

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
                <InputGroup
                  class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-[18rem]"
                >
                  <InputGroupAddon class="pl-2.5">
                    <Search class="h-3.5 w-3.5" />
                  </InputGroupAddon>
                  <InputGroupInput
                    :model-value="query"
                    :placeholder="$t(`${INSPECTOR}.search_placeholder`)"
                    :aria-label="$t(`${INSPECTOR}.search_placeholder`)"
                    autocomplete="off"
                    spellcheck="false"
                    class="h-full text-sm"
                    @update:model-value="
                      (value) => (query = String(value ?? ''))
                    "
                  />
                  <InputGroupAddon align="inline-end" class="pr-2">
                    <button
                      v-if="query"
                      type="button"
                      class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      :aria-label="$t('common.clear')"
                      @click="query = ''"
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </InputGroupAddon>
                </InputGroup>

                <AnimatedFilters
                  :model-value="attentionOnly ? 'attention' : 'all'"
                  square
                  :options="scopeOptions"
                  @update:model-value="
                    (value) => (attentionOnly = value === 'attention')
                  "
                />

                <Popover>
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      :class="[
                        filterTriggerBase,
                        regions.length
                          ? filterTriggerActive
                          : filterTriggerIdle,
                      ]"
                    >
                      <Globe class="h-3.5 w-3.5" />
                      {{ $t("common.region") }}
                      <span v-if="regions.length" :class="filterBadgeClasses">
                        {{ regions.length }}
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
                        regions.includes(region.value)
                          ? 'text-[hsl(var(--tac-amber))]'
                          : 'text-foreground/90'
                      "
                      @click="toggleRegion(region.value)"
                    >
                      <span>{{ region.description || region.value }}</span>
                      <Check
                        v-if="regions.includes(region.value)"
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
                    :model-value="onlyEnabled"
                    :label="$t('pages.game_server_nodes.filters.only_enabled')"
                    @update:model-value="(value) => (onlyEnabled = value)"
                  >
                    <template #icon><CircleDot class="h-3.5 w-3.5" /></template>
                  </FilterToggle>
                  <FilterToggle
                    :model-value="hideOffline"
                    :label="$t('pages.game_server_nodes.filters.hide_offline')"
                    @update:model-value="(value) => (hideOffline = value)"
                  >
                    <template #icon><WifiOff class="h-3.5 w-3.5" /></template>
                  </FilterToggle>
                  <div class="!my-1.5 h-px bg-border" aria-hidden="true"></div>
                  <span
                    class="block px-2 pb-0.5 text-[11px] text-muted-foreground"
                    >{{ $t("common.view") }}</span
                  >
                  <FilterToggle
                    :model-value="displayMetrics"
                    :label="
                      $t('pages.game_server_nodes.filters.display_metrics')
                    "
                    @update:model-value="setDisplayMetrics"
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
                  class="tabular-nums text-[hsl(var(--tac-amber))]"
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
                      :focus-id="focusId"
                      :edge-glide="edgeGlide"
                      :sort="sortDirection"
                      :game-versions="gameVersions"
                      :context="issueContext"
                      :disk-thresholds="issueContext.diskThresholds"
                      :stats="nodeStats"
                      :show-load="displayMetrics"
                      @pick="onRowPick"
                      @action="onRowAction"
                      @focus-row="(id) => (focusId = id)"
                      @sort="toggleSortDirection"
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
            @files="openFiles({ scope: 'node', id: pickedNode.id })"
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
        @files="openFiles({ scope: 'node', id: pickedNode.id })"
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

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import {
  filterNodes,
  fleetSummary,
  isReachable,
  maxServers,
  nodeSettings,
  type NodeFilters,
} from "~/components/game-server-nodes/nodeState";
import {
  idRange,
  linkedNodeId,
  needsAttention,
} from "~/components/game-server-nodes/nodeInspector";
import type { MetricRangeKey } from "~/components/game-server-nodes/nodeMetrics";
import { updateGame } from "~/components/game-server-nodes/nodeActions";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import { observeDockTier, type DockTier } from "~/composables/dockTier";

const FILTERS_KEY = "game-server-nodes-filters";

function savedFilters(): Record<string, any> {
  if (!import.meta.client) {
    return {};
  }
  try {
    return JSON.parse(localStorage.getItem(FILTERS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

// The fleet is a handful of machines an admin runs, so the page loads all of
// it once and filters, sorts and sums on the client. A row opens the node in
// the inspector docked beside the table, or in a sheet when the room right of
// the capped table is too small (see dockTier); Cmd/Ctrl- or Shift-click
// picks several and the inspector becomes the bulk panel. The pick lives in
// component state only: an in-page query key would remount the page. ?node=
// is read once, on load, as a deep link.
export default {
  data() {
    const saved = savedFilters();
    return {
      gameVersions: [] as Array<Record<string, any>>,
      pluginVersions: [] as Array<Record<string, any>>,
      serverRegions: [] as Array<{ value: string; description?: string }>,
      nodes: [] as Array<Record<string, any>>,
      loading: true,
      setupGameServer: null as Record<string, any> | null,
      showSetupDialog: false,
      displayMetrics: true,
      query: (saved.name as string) || "",
      regions: (saved.regions as Array<string>) || [],
      onlyEnabled: !!saved.onlyEnabled,
      hideOffline: !!saved.hideOffline,
      attentionOnly: !!saved.attentionOnly,
      sortDirection: (saved.sortDirection as "asc" | "desc") || "asc",
      // The inspector
      pickedId: null as string | null,
      multiIds: [] as Array<string>,
      focusId: null as string | null,
      anchorId: null as string | null,
      swapAnimate: true,
      edgeGlide: false,
      tier: "sheet" as DockTier,
      // The docked width the aside keeps, also while it leaves for a sheet.
      lastDock: "docked" as Exclude<DockTier, "sheet">,
      // The panel is moving between aside and sheet: both fade.
      tierSwap: false,
      stopTier: null as (() => void) | null,
      metricsRange: "live" as MetricRangeKey,
      request: null as {
        nodeId: string;
        kind: "rename" | "ports";
        n: number;
      } | null,
      nodeStats: {} as Record<string, any>,
      removeTarget: null as Record<string, any> | null,
      removeOpen: false,
      linkRead: false,
      modifierKey: "Ctrl",
    };
  },
  apollo: {
    $subscribe: {
      game_versions: {
        query: typedGql("subscription")({
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
        result(this: any, { data }: any) {
          this.gameVersions = data.game_versions;
        },
      },
      plugin_versions: {
        query: typedGql("subscription")({
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
        result(this: any, { data }: any) {
          this.pluginVersions = data.plugin_versions;
        },
      },
      server_regions: {
        query: typedGql("subscription")({
          server_regions: [{}, { value: true, description: true }],
        }),
        result(this: any, { data }: any) {
          this.serverRegions = data.server_regions || [];
        },
      },
      game_server_nodes: {
        query: typedGql("subscription")({
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
            } as any,
          ],
        }),
        result(this: any, { data }: any) {
          this.loading = false;
          this.nodes = data.game_server_nodes;
        },
        error(this: any) {
          this.loading = false;
        },
      },
    },
  },
  computed: {
    currentGameVersion(): Record<string, any> | undefined {
      return this.gameVersions.find((version) => version.current === true);
    },
    supportsGameServerNodes(): boolean {
      return useApplicationSettingsStore().supportsGameServerNodes;
    },
    settings() {
      return nodeSettings(useApplicationSettingsStore().settings);
    },
    pinning(): any {
      return this.settings.pinning;
    },
    issueContext(): any {
      const { pinning, disk } = this.settings;
      return {
        currentBuildId: this.currentGameVersion?.build_id ?? null,
        maxServers: (node: any) => maxServers(node, pinning),
        diskThresholds: disk,
      };
    },
    summary() {
      return fleetSummary(this.nodes as any, this.issueContext);
    },
    scopeOptions(): Array<{ key: string; label: string; count?: number }> {
      return [
        { key: "all", label: this.$t("common.all") },
        {
          key: "attention",
          label: this.$t("pages.system_metrics.scope_attention"),
          count: this.summary.attention || undefined,
        },
      ];
    },
    filters(): NodeFilters {
      return {
        query: this.query,
        regions: this.regions,
        onlyEnabled: this.onlyEnabled,
        hideOffline: this.hideOffline,
        sort: this.sortDirection,
      };
    },
    visibleNodes(): Array<Record<string, any>> {
      const list = filterNodes(this.nodes as any, this.filters);
      return this.attentionOnly
        ? list.filter((node) => needsAttention(node, this.issueContext))
        : list;
    },
    pickedNode(): Record<string, any> | null {
      return this.nodes.find((node) => node.id === this.pickedId) ?? null;
    },
    isMulti(): boolean {
      return this.multiIds.length > 1;
    },
    // Bulk actions only reach rows the admin can see.
    selectedNodes(): Array<Record<string, any>> {
      return this.visibleNodes.filter((node) =>
        this.multiIds.includes(node.id),
      );
    },
    inspecting(): boolean {
      return this.isMulti || !!this.pickedNode;
    },
    docked(): boolean {
      return this.tier !== "sheet" && this.inspecting;
    },
    sheetOpen(): boolean {
      return this.tier === "sheet" && this.inspecting;
    },
    // CPU and memory for every row that shows load; the inspected node gets
    // the full set (disks, network, GPUs) for its Live section.
    polls(): Array<{ id: string; full: boolean }> {
      const inspected =
        !this.isMulti && this.pickedNode?.status !== "Setup"
          ? this.pickedId
          : null;
      const ids = this.displayMetrics
        ? this.visibleNodes
            .filter((node) => isReachable(node as any))
            .map((node) => node.id)
        : [];
      if (inspected && !ids.includes(inspected)) {
        ids.push(inspected);
      }
      return ids.map((id) => ({ id, full: id === inspected }));
    },
    optionsActiveCount(): number {
      return (this.onlyEnabled ? 1 : 0) + (this.hideOffline ? 1 : 0);
    },
    hasActiveFilters(): boolean {
      return (
        this.query !== "" ||
        this.regions.length > 0 ||
        this.onlyEnabled ||
        this.hideOffline ||
        this.attentionOnly ||
        this.sortDirection !== "asc"
      );
    },
  },
  watch: {
    filters: {
      deep: true,
      handler() {
        this.saveFiltersToStorage();
      },
    },
    attentionOnly() {
      this.saveFiltersToStorage();
    },
    nodes(nodes: Array<Record<string, any>>) {
      const ids = new Set(nodes.map((node) => node.id));
      if (this.multiIds.some((id) => !ids.has(id))) {
        const left = this.multiIds.filter((id) => ids.has(id));
        this.multiIds = left.length > 1 ? left : [];
        if (left.length === 1) {
          this.pickedId = left[0];
        }
      }
      if (this.pickedId && !ids.has(this.pickedId)) {
        this.pickedId = null;
      }
      this.readLink();
    },
  },
  methods: {
    saveFiltersToStorage() {
      try {
        localStorage.setItem(
          FILTERS_KEY,
          JSON.stringify({
            name: this.query,
            regions: this.regions,
            onlyEnabled: this.onlyEnabled,
            hideOffline: this.hideOffline,
            attentionOnly: this.attentionOnly,
            sortDirection: this.sortDirection,
            sortField: "label",
          }),
        );
      } catch {
        // storage can be unavailable (private mode); filters just don't stick
      }
    },
    resetFilters() {
      this.query = "";
      this.regions = [];
      this.onlyEnabled = false;
      this.hideOffline = false;
      this.attentionOnly = false;
      this.sortDirection = "asc";
    },
    toggleRegion(value: string) {
      this.regions = this.regions.includes(value)
        ? this.regions.filter((region) => region !== value)
        : [...this.regions, value];
    },
    toggleSortDirection() {
      this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
    },
    setDisplayMetrics(value: boolean) {
      this.displayMetrics = value;
      try {
        localStorage.setItem("displayMetrics", String(value));
      } catch {
        // see saveFiltersToStorage
      }
    },
    onStats(id: string, stats: any) {
      this.nodeStats = {
        ...this.nodeStats,
        [id]: stats ? Object.freeze(stats) : null,
      };
    },

    // ---- picking ----
    pick(id: string, { kbd = false, instant = false } = {}) {
      this.focusId = id;
      this.anchorId = id;
      const wasMulti = this.isMulti;
      const opening = !this.inspecting;
      this.multiIds = [];
      this.tierSwap = false;
      if (this.pickedId === id && !wasMulti) {
        return;
      }
      // A rename or ports request belongs to the node it was made on.
      this.request = null;
      this.swapAnimate = !kbd && !instant;
      this.edgeGlide = !kbd && !instant && !opening && !wasMulti;
      this.pickedId = id;
    },
    multiPick(id: string, range: boolean) {
      const ids = this.visibleNodes.map((node) => node.id);
      const set = new Set(
        this.isMulti ? this.multiIds : this.pickedId ? [this.pickedId] : [],
      );
      if (range) {
        const from = this.anchorId || this.pickedId || this.focusId || id;
        idRange(ids, from, id).forEach((value) => set.add(value));
      } else {
        if (set.has(id)) {
          set.delete(id);
        } else {
          set.add(id);
        }
        this.anchorId = id;
      }
      if (set.size < 2) {
        const [only] = [...set];
        if (only) {
          this.pick(only);
        } else {
          this.closeInspector();
        }
        return;
      }
      this.swapAnimate = !this.isMulti;
      this.multiIds = ids.filter((value) => set.has(value));
      this.pickedId = set.has(id)
        ? id
        : this.multiIds[this.multiIds.length - 1];
      this.focusId = id;
    },
    unpick(id: string) {
      const left = this.multiIds.filter((value) => value !== id);
      if (left.length < 2) {
        if (left[0]) {
          this.pick(left[0]);
        } else {
          this.closeInspector();
        }
        return;
      }
      this.multiIds = left;
      if (this.pickedId === id) {
        this.pickedId = left[left.length - 1];
      }
    },
    onSheetAutoFocus(event: Event) {
      event.preventDefault();
      (event.target as HTMLElement | null)
        ?.querySelector<HTMLElement>("[data-node-sheet-title]")
        ?.focus();
    },
    closeInspector() {
      const was = this.pickedId;
      const aside = this.$refs.aside as HTMLElement | undefined;
      const hadFocus = !!aside?.contains(document.activeElement);
      this.tierSwap = false;
      this.pickedId = null;
      this.multiIds = [];
      if (hadFocus && was) {
        this.$nextTick(() =>
          this.rowElement(was)?.focus({ preventScroll: true }),
        );
      }
    },
    rowElement(id: string): HTMLElement | null {
      return (
        (this.$refs.list as HTMLElement | undefined)?.querySelector(
          `tr[data-node="${CSS.escape(id)}"]`,
        ) ?? null
      );
    },
    move(delta: number) {
      const ids = this.visibleNodes.map((node) => node.id);
      if (!ids.length) {
        return;
      }
      const current = this.pickedId || this.focusId;
      let index = current ? ids.indexOf(current) : -1;
      index =
        index < 0
          ? delta > 0
            ? 0
            : ids.length - 1
          : Math.min(ids.length - 1, Math.max(0, index + delta));
      const id = ids[index];
      this.focusId = id;
      if (this.pickedId) {
        this.pick(id, { kbd: true });
      }
      this.$nextTick(() => {
        const row = this.rowElement(id);
        row?.focus({ preventScroll: true });
        row?.scrollIntoView({ block: "nearest" });
      });
    },
    resetInspectorScroll() {
      const aside = this.$refs.aside as HTMLElement | undefined;
      if (aside) {
        aside.scrollTop = 0;
      }
    },
    onRowPick(id: string, event: MouseEvent | KeyboardEvent) {
      if (
        event instanceof MouseEvent &&
        (event.metaKey || event.ctrlKey || event.shiftKey)
      ) {
        this.multiPick(id, event.shiftKey);
        return;
      }
      this.pick(id, { kbd: event instanceof KeyboardEvent });
    },
    async onRowAction(action: string, id: string) {
      const node = this.nodes.find((entry) => entry.id === id);
      if (!node) {
        return;
      }
      switch (action) {
        case "open":
          this.pick(id);
          return;
        case "select":
          this.multiPick(id, false);
          return;
        case "rename":
        case "ports":
          this.pick(id, { instant: true });
          this.request = {
            nodeId: id,
            kind: action,
            n: (this.request?.n ?? 0) + 1,
          };
          return;
        case "files":
          useFilePopout().openFiles({ scope: "node", id });
          return;
        case "remove":
          this.askRemove(id);
          return;
        case "update":
          try {
            await updateGame(this.$apollo as any, id);
            toast({ title: this.$t("game_server.toast.cs_updating") });
          } catch (error: any) {
            toast({
              variant: "destructive",
              title: this.$t("pages.game_server_nodes.toast.save_failed"),
              description: error?.message,
            });
          }
      }
    },
    openFiles(target: { scope: "node"; id: string }) {
      useFilePopout().openFiles(target);
    },
    askRemove(id: string) {
      this.removeTarget = this.nodes.find((node) => node.id === id) ?? null;
      this.removeOpen = !!this.removeTarget;
    },
    // A deep link from another page (/game-server-nodes?node=<id>), read once
    // the nodes have arrived. Never written back: the query key would remount
    // the page.
    readLink() {
      if (this.linkRead || !this.nodes.length) {
        return;
      }
      this.linkRead = true;
      const id = linkedNodeId(this.$route.query.node, this.nodes);
      if (!id) {
        return;
      }
      if (!this.visibleNodes.some((node) => node.id === id)) {
        this.resetFilters();
      }
      this.pick(id, { instant: true });
      this.$nextTick(() =>
        requestAnimationFrame(() =>
          this.rowElement(id)?.scrollIntoView({ block: "center" }),
        ),
      );
    },
    onKeydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement;
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"]',
        )
      ) {
        return;
      }
      const list = this.$refs.list as HTMLElement | undefined;
      const aside = this.$refs.aside as HTMLElement | undefined;
      const inList = !!list?.contains(target);
      const inAside = !!aside?.contains(target);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (
          !inList &&
          !inAside &&
          !(target === document.body && this.pickedId)
        ) {
          return;
        }
        event.preventDefault();
        this.move(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Escape" && this.docked) {
        this.closeInspector();
      }
    },
    // The room changed (window, nav or hub): the open panel moves between
    // the aside and the sheet, keeping its pick and range. Wide and narrow
    // docks share the aside, so that switch only reflows it, under a fade.
    onTier(tier: DockTier) {
      const was = this.tier;
      this.tierSwap = this.inspecting;
      // A remounted inspector would replay it.
      this.request = null;
      if (tier !== "sheet") {
        this.lastDock = tier;
      }
      this.tier = tier;
      if (this.inspecting && was !== "sheet" && tier !== "sheet") {
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
    async createGameServerNode() {
      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          setupGameServer: {
            link: true,
            gameServerId: true,
          },
        }),
      });

      this.setupGameServer = data.setupGameServer;
      this.showSetupDialog = true;
    },
    closeSetupDialog() {
      this.showSetupDialog = false;
      setTimeout(() => {
        this.setupGameServer = null;
      }, 300);
    },
  },
  created() {
    if (import.meta.client) {
      try {
        // On unless the admin switched it off.
        this.displayMetrics =
          localStorage.getItem("displayMetrics") !== "false";
      } catch {
        // see saveFiltersToStorage
      }
    }
  },
  mounted() {
    this.modifierKey = /Mac|iP/.test(navigator.platform || "") ? "⌘" : "Ctrl";
    this.stopTier = observeDockTier(
      this.$refs.page as HTMLElement,
      this.onTier,
    );
    document.addEventListener("keydown", this.onKeydown);
  },
  beforeUnmount() {
    this.stopTier?.();
    document.removeEventListener("keydown", this.onKeydown);
  },
};
</script>

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
