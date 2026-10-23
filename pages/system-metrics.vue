<script setup lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import AdminSearch from "~/components/admin/AdminSearch.vue";
import LiveStamp from "~/components/admin/LiveStamp.vue";
import NodeStatsPoller from "~/components/system-metrics/NodeStatsPoller.vue";
import MetricsAttention from "~/components/system-metrics/MetricsAttention.vue";
import ServiceMetricsTable from "~/components/system-metrics/ServiceMetricsTable.vue";
import ServiceLogsSheet from "~/components/system-metrics/ServiceLogsSheet.vue";

definePageMeta({
  middleware: "admin",
  // A link's ?node= and ?service= are read and then dropped from the URL:
  // without this the page key changes and the whole route remounts.
  persistQueryKeys: ["node", "service"],
});
</script>

<template>
  <div class="grid gap-8">
    <h1 class="sr-only">{{ $t("layouts.app_nav.system.metrics") }}</h1>

    <!-- One getNodeStats poll per online node, plus any other node a live
         service reports from (for its disk); offline nodes are only counted. -->
    <NodeStatsPoller
      v-for="id in statNodeIds"
      :key="id"
      :node-id="id"
      @stats="onNodeStats"
    />

    <PageTransition>
      <div class="flex flex-wrap items-center gap-2">
        <AdminSearch
          v-model="search"
          shortcut
          :placeholder="$t('pages.system_metrics.search_placeholder')"
        />

        <AnimatedFilters v-model="scope" square :options="scopeOptions" />

        <span class="grow" />

        <LiveStamp
          :at="updatedAt"
          live
          clock
          :stale-after="75000"
          :tip="$t('pages.system_metrics.live_hint')"
        />

        <FilterMenu
          :count="filterCount"
          :active="filterCount > 0"
          :show-reset="filterCount > 0"
          content-class="w-64 space-y-0.5 p-2"
          @reset="resetNodeFilters"
        >
          <div
            class="px-2 pb-1 pt-0.5 text-[0.7rem] font-medium text-muted-foreground"
          >
            {{ $t("pages.system_metrics.filter_group") }}
          </div>
          <FilterToggle
            v-model="onlyOnline"
            :label="$t('pages.system_metrics.only_online')"
          />
          <FilterToggle
            v-model="onlyEnabled"
            :label="$t('pages.system_metrics.only_enabled')"
          />
        </FilterMenu>
      </div>
    </PageTransition>

    <!-- Triage and Services share one left-aligned measure; a full-width
         table would leave the Service column mostly empty. -->
    <PageTransition :step="1">
      <FadeSwap class="max-w-[960px]">
        <div
          v-if="!attentionReady"
          key="loading"
          class="grid gap-4"
          aria-busy="true"
        >
          <Skeleton class="h-6 w-64 rounded-md" />
          <Skeleton class="h-[4.5rem] w-full rounded-lg" />
          <Skeleton class="h-5 w-full max-w-xl rounded-md" />
        </div>

        <SectionEmpty
          v-else-if="!nodes.length"
          key="no-nodes"
          :title="$t('pages.system_metrics.no_nodes_title')"
          :description="$t('pages.system_metrics.no_nodes_hint')"
        >
          <Button as-child variant="outline" size="sm">
            <NuxtLink to="/game-server-nodes">
              {{ $t("pages.system_metrics.setup_node") }}
            </NuxtLink>
          </Button>
        </SectionEmpty>

        <MetricsAttention
          v-else
          key="attention"
          :issues="issues"
          :summary="summary"
          :node-name="nodeName"
          :logs-for="logsForIssue"
          @logs="openLogs"
        />
      </FadeSwap>
    </PageTransition>

    <PageTransition :step="2">
      <ManageSection
        class="max-w-[960px]"
        :label="$t('pages.system_metrics.services')"
        :hint="
          services.length
            ? $t('pages.system_metrics.services_reporting', {
                count: reportingCount,
              })
            : ''
        "
      >
        <template v-if="serviceNodes.length > 1" #action>
          <Select v-model="serviceNode">
            <SelectTrigger
              class="h-8 w-48"
              :aria-label="$t('pages.system_metrics.filter_by_node')"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">
                {{ $t("pages.system_metrics.all_nodes") }}
              </SelectItem>
              <SelectItem v-for="id in serviceNodes" :key="id" :value="id">
                {{ nodeName(id) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </template>

        <FadeSwap>
          <div
            v-if="!getServiceStats"
            key="loading"
            class="grid gap-2"
            aria-busy="true"
          >
            <Skeleton v-for="i in 6" :key="i" class="h-11 w-full rounded-md" />
          </div>

          <SectionEmpty
            v-else-if="!services.length"
            key="none"
            :title="$t('pages.system_metrics.no_services_title')"
            :description="$t('pages.system_metrics.no_services_hint')"
          />

          <SectionEmpty
            v-else-if="
              !serviceRows.length && scope === 'attention' && !hasQuery
            "
            key="calm"
            :title="$t('pages.system_metrics.no_attention_title')"
            :description="$t('pages.system_metrics.no_attention_hint')"
          />

          <SectionEmpty
            v-else-if="!serviceRows.length"
            key="filtered"
            :title="$t('pages.system_metrics.no_match_title')"
            :description="$t('pages.system_metrics.no_match_hint')"
          >
            <Button variant="outline" size="sm" @click="clearAll">
              {{ $t("pages.system_metrics.clear_filters") }}
            </Button>
          </SectionEmpty>

          <ServiceMetricsTable
            v-else
            key="table"
            :rows="serviceRows"
            :sort-key="sortKey"
            :sort-dir="sortDir"
            :now="updatedAt ?? Date.now()"
            :reveal="revealKey"
            @sort="setSort"
            @logs="openLogs"
            @revealed="linked = null"
          />
        </FadeSwap>
      </ManageSection>
    </PageTransition>

    <ServiceLogsSheet
      v-model:open="logsOpen"
      :service="logsTarget"
      :node-label="logsTarget ? nodeName(logsTarget.node) : ''"
    />
  </div>
</template>

<script lang="ts">
import { nextSort } from "~/components/admin/sort";
import {
  readRememberedView,
  saveRememberedView,
} from "~/composables/useRememberedView";
import {
  collectIssues,
  fleetSummary,
  isOnline,
  lastSampleTime,
  linkedServiceKey,
  metricsLink,
  nodeDisk,
  serviceCpu,
  serviceCpuSpark,
  serviceMemoryBytes,
  serviceMemoryShare,
  serviceSeverity,
  shortNodeId,
  warnedServer,
  type MetricIssue,
  type MetricsLink,
  type MetricsNode,
  type NodeStats,
  type ServiceRow,
  type ServiceSortKey,
  type ServiceStat,
} from "~/components/system-metrics/metricRules";

// A service on a node the table does not know (the panel's own node, say) is
// treated as gone once its newest sample is this old.
const STALE_AFTER_MS = 3 * 60_000;
const SORT_KEYS: ServiceSortKey[] = ["name", "cpu", "memory", "disk"];

const VIEW_DEFAULTS = {
  scope: "all" as "all" | "attention",
  onlyOnline: false,
  onlyEnabled: false,
  serviceNode: "__all",
  sortKey: "cpu" as ServiceSortKey,
  sortDir: "desc" as "asc" | "desc",
};

const VIEW_VALIDATORS = {
  scope: (v: unknown) => v === "all" || v === "attention",
  sortKey: (v: unknown) => SORT_KEYS.includes(v as ServiceSortKey),
  sortDir: (v: unknown) => v === "asc" || v === "desc",
};

export default {
  data() {
    const view = readRememberedView(
      "system-metrics",
      VIEW_DEFAULTS,
      VIEW_VALIDATORS,
    );
    // A link (the admin home's) opens on every service of its node, whatever
    // filters were left on, for this visit only: nothing here is remembered.
    const linked = metricsLink(this.$route.query);
    return {
      search: "",
      ...view,
      ...(linked && {
        scope: "all" as const,
        onlyOnline: false,
        onlyEnabled: false,
        serviceNode: linked.node ?? "__all",
      }),
      linked: linked as MetricsLink | null,
      nodeStats: {} as Record<string, NodeStats | null>,
      updatedAt: null as number | null,
      logsOpen: false,
      logsTarget: null as ServiceStat | null,
    };
  },
  mounted() {
    if (this.linked) {
      const { node: _node, service: _service, ...rest } = this.$route.query;
      void this.$router.replace({ query: rest });
    }
  },
  methods: {
    onNodeStats(nodeId: string, stats: NodeStats | null) {
      // A failed poll keeps the last good answer rather than wiping the row.
      if (stats || !(nodeId in this.nodeStats)) {
        this.nodeStats = { ...this.nodeStats, [nodeId]: stats };
      }
    },
    nodeName(id: string): string {
      const node = this.nodesById[id];
      return node?.label || id;
    },
    serviceOnNode(nodeId: string, test: (name: string) => boolean) {
      return (
        this.services.find(
          (service: ServiceStat) =>
            service.node === nodeId && test(service.name),
        ) ?? null
      );
    },
    logsForIssue(issue: MetricIssue): ServiceStat | null {
      const server = warnedServer(issue.warning);
      return (
        (server && this.serviceOnNode(issue.nodeId, (n) => n === server)) ||
        this.serviceOnNode(issue.nodeId, (n) =>
          n.startsWith("game-server-node-connector"),
        )
      );
    },
    openLogs(service: ServiceStat) {
      this.logsTarget = { node: service.node, name: service.name };
      this.logsOpen = true;
    },
    setSort(key: ServiceSortKey) {
      const next = nextSort({ key: this.sortKey, dir: this.sortDir }, key, {
        cpu: "desc",
        memory: "desc",
        disk: "desc",
      });
      this.sortKey = next.key;
      this.sortDir = next.dir;
    },
    resetNodeFilters() {
      this.onlyOnline = false;
      this.onlyEnabled = false;
    },
    clearAll() {
      this.search = "";
      this.serviceNode = "__all";
      this.scope = "all";
      this.resetNodeFilters();
    },
    isStale(service: ServiceStat): boolean {
      const node = this.nodesById[service.node];
      if (node) {
        return !isOnline(node);
      }
      const t = lastSampleTime(service);
      return t == null || (this.updatedAt ?? Date.now()) - t > STALE_AFTER_MS;
    },
  },
  watch: {
    viewSnapshot(snapshot: typeof VIEW_DEFAULTS) {
      saveRememberedView("system-metrics", snapshot, VIEW_DEFAULTS);
    },
    // A remembered node that no longer reports falls back to all nodes.
    serviceNodes(ids: string[]) {
      if (
        this.serviceNode !== "__all" &&
        this.getServiceStats &&
        !ids.includes(this.serviceNode)
      ) {
        this.serviceNode = "__all";
      }
    },
  },
  computed: {
    viewSnapshot(): typeof VIEW_DEFAULTS {
      return {
        scope: this.scope,
        onlyOnline: this.onlyOnline,
        onlyEnabled: this.onlyEnabled,
        serviceNode: this.serviceNode,
        sortKey: this.sortKey,
        sortDir: this.sortDir,
      };
    },
    nodes(): MetricsNode[] {
      return (this.game_server_nodes as MetricsNode[] | undefined) ?? [];
    },
    nodesById(): Record<string, MetricsNode> {
      return Object.fromEntries(this.nodes.map((node) => [node.id, node]));
    },
    onlineNodes(): MetricsNode[] {
      return this.nodes.filter(isOnline);
    },
    statNodeIds(): string[] {
      const ids = this.onlineNodes.map((node) => node.id);
      if (!this.game_server_nodes) {
        return ids;
      }
      for (const service of this.services) {
        if (
          !this.nodesById[service.node] &&
          !ids.includes(service.node) &&
          !this.isStale(service)
        ) {
          ids.push(service.node);
        }
      }
      return ids;
    },
    // The verdict waits until every online node has answered once, so it
    // never says "nothing needs attention" about nodes it has not read yet.
    attentionReady(): boolean {
      return (
        !!this.game_server_nodes &&
        this.onlineNodes.every((node) => node.id in this.nodeStats)
      );
    },
    issues(): MetricIssue[] {
      return collectIssues(this.onlineNodes, this.nodeStats, (node) =>
        this.nodeName(node.id),
      );
    },
    summary() {
      return fleetSummary(this.nodes, this.nodeStats, this.issues);
    },
    services(): ServiceStat[] {
      return ((this.getServiceStats as ServiceStat[] | undefined) ?? []).filter(
        (service) => service.cpu?.length || service.memory?.length,
      );
    },
    allRows(): ServiceRow[] {
      return this.services.map((service) => {
        const label = this.nodesById[service.node]?.label;
        return {
          key: `${service.node}|${service.name}`,
          service,
          nodeLabel: this.nodeName(service.node),
          nodeShort: label || shortNodeId(service.node),
          nodeIsId: !label,
          stale: this.isStale(service),
          lastSeen: lastSampleTime(service),
          cpu: serviceCpu(service),
          memoryBytes: serviceMemoryBytes(service),
          share: serviceMemoryShare(service),
          disk: nodeDisk(this.nodeStats[service.node]),
          severity: serviceSeverity(service),
          spark: serviceCpuSpark(service),
        };
      });
    },
    // The linked service's row, once the table has it.
    revealKey(): string | null {
      return linkedServiceKey(this.allRows, this.linked);
    },
    attentionCount(): number {
      return this.allRows.filter((row) => !row.stale && row.severity).length;
    },
    reportingCount(): number {
      return this.allRows.filter((row) => !row.stale).length;
    },
    scopeOptions() {
      return [
        { key: "all", label: this.$t("pages.system_metrics.scope_all") },
        {
          key: "attention",
          label: this.$t("pages.system_metrics.scope_attention"),
          count: this.attentionCount || undefined,
        },
      ];
    },
    filterCount(): number {
      return Number(this.onlyOnline) + Number(this.onlyEnabled);
    },
    hasQuery(): boolean {
      return (
        !!this.search.trim() ||
        this.serviceNode !== "__all" ||
        this.filterCount > 0
      );
    },
    serviceNodes(): string[] {
      return [...new Set(this.services.map((service) => service.node))].sort(
        (a, b) => this.nodeName(a).localeCompare(this.nodeName(b)),
      );
    },
    serviceRows(): ServiceRow[] {
      const term = this.search.trim().toLowerCase();
      const rows = this.allRows.filter((row) => {
        const node = this.nodesById[row.service.node];
        if (this.onlyOnline && row.stale) return false;
        if (this.onlyEnabled && node && !node.enabled) return false;
        if (
          this.serviceNode !== "__all" &&
          row.service.node !== this.serviceNode
        ) {
          return false;
        }
        if (this.scope === "attention" && (row.stale || !row.severity)) {
          return false;
        }
        if (
          term &&
          !`${row.service.name} ${row.nodeLabel} ${row.service.node}`
            .toLowerCase()
            .includes(term)
        ) {
          return false;
        }
        return true;
      });

      const dir = this.sortDir === "asc" ? 1 : -1;
      const value = (row: ServiceRow) =>
        this.sortKey === "cpu"
          ? (row.cpu ?? -1)
          : this.sortKey === "memory"
            ? (row.share ?? -1)
            : this.sortKey === "disk"
              ? (row.disk?.pct ?? -1)
              : row.service.name;

      return rows.sort((a, b) => {
        // Rows from an offline node keep their last numbers but go last.
        if (a.stale !== b.stale) {
          return a.stale ? 1 : -1;
        }
        const x = value(a);
        const y = value(b);
        const d =
          typeof x === "string"
            ? x.localeCompare(y as string)
            : (x as number) - (y as number);
        return d * dir || a.service.name.localeCompare(b.service.name);
      });
    },
  },
  apollo: {
    getServiceStats: {
      query: generateQuery({
        getServiceStats: [
          {},
          {
            node: true,
            name: true,
            cpu: [{}, { time: true, total: true, used: true, window: true }],
            memory: [{}, { time: true, total: true, used: true }],
          },
        ],
      }),
      pollInterval: 30 * 1000,
      result(this: any) {
        this.updatedAt = Date.now();
      },
    },
    game_server_nodes: {
      query: generateQuery({
        game_server_nodes: [
          {},
          {
            id: true,
            label: true,
            region: true,
            enabled: true,
            offline_at: true,
            gpu: true,
            gpu_info: true,
            cpu_warnings: true,
          },
        ],
      }),
      pollInterval: 30 * 1000,
    },
  },
};
</script>
