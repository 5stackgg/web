<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
import { generateQuery } from "~/graphql/graphqlGen";
import { Button } from "~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
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
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import NodeStatsPoller from "~/components/system-metrics/NodeStatsPoller.vue";
import MetricsAttention from "~/components/system-metrics/MetricsAttention.vue";
import ServiceMetricsTable from "~/components/system-metrics/ServiceMetricsTable.vue";
import ServiceLogsSheet from "~/components/system-metrics/ServiceLogsSheet.vue";

definePageMeta({ middleware: "admin" });
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

    <PageTransition :delay="0">
      <div class="flex flex-wrap items-center gap-2">
        <InputGroup class="h-8 w-full bg-card/60 sm:w-64">
          <InputGroupAddon class="pl-2.5">
            <Search class="h-3.5 w-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            v-model="search"
            :placeholder="$t('pages.system_metrics.search_placeholder')"
            :aria-label="$t('pages.system_metrics.search_placeholder')"
            class="h-full text-sm"
          />
          <InputGroupAddon align="inline-end" class="pr-2">
            <button
              v-if="search"
              type="button"
              class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              :aria-label="$t('common.clear')"
              @click="search = ''"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </InputGroupAddon>
        </InputGroup>

        <AnimatedFilters v-model="scope" square :options="scopeOptions" />

        <span class="grow" />

        <FiveStackToolTip v-if="updatedAt" as-child :delay-duration="120">
          <template #trigger>
            <span
              tabindex="0"
              class="inline-flex h-8 items-center gap-2 whitespace-nowrap text-xs tabular-nums text-muted-foreground"
            >
              <span class="relative flex h-2 w-2">
                <span
                  class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden"
                />
                <span
                  class="relative inline-flex h-2 w-2 rounded-full bg-success"
                />
              </span>
              {{ $t("pages.system_metrics.live", { time: clock(updatedAt) }) }}
            </span>
          </template>
          <span class="block max-w-[16rem]">
            {{ $t("pages.system_metrics.live_hint") }}
          </span>
        </FiveStackToolTip>

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
    <PageTransition :delay="40">
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

    <PageTransition :delay="80">
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
            @sort="setSort"
            @logs="openLogs"
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
import { dateLocale } from "~/utilities/dateLocale";
import {
  collectIssues,
  fleetSummary,
  isOnline,
  lastSampleTime,
  nodeDisk,
  serviceCpu,
  serviceCpuSpark,
  serviceMemoryBytes,
  serviceMemoryShare,
  serviceSeverity,
  shortNodeId,
  warnedServer,
  type MetricIssue,
  type MetricsNode,
  type NodeStats,
  type ServiceRow,
  type ServiceSortKey,
  type ServiceStat,
} from "~/components/system-metrics/metricRules";

// A service on a node the table does not know (the panel's own node, say) is
// treated as gone once its newest sample is this old.
const STALE_AFTER_MS = 3 * 60_000;

export default {
  data() {
    return {
      search: "",
      scope: "all" as "all" | "attention",
      onlyOnline: false,
      onlyEnabled: false,
      serviceNode: "__all",
      sortKey: "cpu" as ServiceSortKey,
      sortDir: "desc" as "asc" | "desc",
      nodeStats: {} as Record<string, NodeStats | null>,
      updatedAt: null as number | null,
      logsOpen: false,
      logsTarget: null as ServiceStat | null,
    };
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
    clock(t: number) {
      return new Date(t).toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
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
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
        return;
      }
      this.sortKey = key;
      this.sortDir = key === "name" ? "asc" : "desc";
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
  computed: {
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
