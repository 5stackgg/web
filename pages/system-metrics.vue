<script setup lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import CpuChart from "~/components/charts/CpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import NodeMetrics from "~/components/system-metrics/NodeMetrics.vue";
import NodeQuickStats from "~/components/system-metrics/NodeQuickStats.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Activity, Cpu, HardDrive, Network, Logs } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

const showSeparators = computed(
  () => useApplicationSettingsStore().showSeparators,
);
</script>

<template>
  <!-- Page heading & high-level summary -->
  <PageTransition :delay="0">
    <PageHeading>
      <template #title>{{ $t("pages.system_metrics.title") }}</template>
      <template #description>
        {{ $t("pages.system_metrics.description") }}
      </template>
      <template #actions>
        <div class="flex flex-wrap items-center gap-3">
          <Badge variant="outline" class="text-xs px-3 py-1">
            {{ $t("pages.system_metrics.services_count") }}:
            {{ totalServices }}
          </Badge>
          <Badge variant="outline" class="text-xs px-3 py-1">
            {{ $t("pages.system_metrics.nodes_count") }}:
            {{ totalGameNodes }}
          </Badge>
        </div>
      </template>
    </PageHeading>
  </PageTransition>

  <!-- Game server nodes section (now on top) -->
  <PageTransition :delay="100" class="mt-6">
    <Card class="p-4 space-y-4">
      <div
        class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
      >
        <div class="flex items-center gap-2">
          <Activity class="h-5 w-5 text-muted-foreground" />
          <h2 class="text-base font-semibold">
            {{ $t("pages.game_server_nodes.title") }}
          </h2>
        </div>

        <!-- Nodes filters & quick stats -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="w-full sm:w-60">
            <Input
              v-model="nodeSearchTerm"
              :placeholder="$t('pages.system_metrics.search_nodes_placeholder')"
            />
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">
                {{ $t("pages.game_server_nodes.only_enabled") }}
              </span>
              <Switch v-model="onlyEnabledNodes" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">
                {{ $t("pages.system_metrics.only_online_nodes") }}
              </span>
              <Switch v-model="onlyOnlineNodes" />
            </div>
          </div>
          <div
            class="flex items-center gap-2 flex-wrap text-xs text-muted-foreground"
          >
            <span>Sort nodes by</span>
            <Select v-model="nodeSortBy">
              <SelectTrigger class="h-7 w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpu">CPU</SelectItem>
                <SelectItem value="memory">Memory</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            <Select v-model="nodeSortDirection">
              <SelectTrigger class="h-7 w-24">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Desc</SelectItem>
                <SelectItem value="asc">Asc</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              {{ $t("pages.system_metrics.nodes_total") }}:
              {{ totalGameNodes }}
            </Badge>
          </div>
        </div>
      </div>

      <Separator
        v-if="showSeparators && filteredNodes && filteredNodes.length"
        class="my-2"
      />

      <div
        v-if="filteredNodes && filteredNodes.length"
        class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <Card
          v-for="node in filteredNodes"
          :key="node.id"
          :class="[
            'p-4 space-y-3',
            isNodeExpanded(node) ? 'md:col-span-2 xl:col-span-3' : '',
          ]"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1 min-w-0">
              <div class="text-sm font-semibold truncate">
                {{ node.label || node.id }}
              </div>
              <div class="w-full text-xs text-muted-foreground min-w-0">
                <span class="truncate block">
                  <template v-if="node.region">
                    {{ node.region }} · {{ node.id }}
                  </template>
                  <template v-else>
                    {{ node.id }}
                  </template>
                </span>
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">
              <div class="flex items-center gap-2">
                <Badge v-if="node.enabled" variant="outline" class="text-xs">
                  {{ $t("common.enabled") }}
                </Badge>
                <Badge v-else variant="outline" class="text-xs">
                  {{ $t("common.disabled") }}
                </Badge>
                <FiveStackToolTip :delay-duration="300">
                  <template #trigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      @click="toggleNodeExpanded(node)"
                    >
                      <Activity
                        class="h-4 w-4"
                        :class="isNodeExpanded(node) ? 'text-primary' : ''"
                      />
                    </Button>
                  </template>
                  <span>
                    {{
                      isNodeExpanded(node)
                        ? $t("common.hide_metrics")
                        : $t("common.show_metrics")
                    }}
                  </span>
                </FiveStackToolTip>
              </div>
            </div>
          </div>

          <!-- Quick latest metrics summary -->
          <NodeQuickStats
            :node-id="node.id"
            @update-latest-metrics="updateNodeMetrics"
          />

          <div class="pt-2 border-t mt-2" v-if="isNodeExpanded(node)">
            <NodeMetrics :game-server-node="node" />
          </div>
        </Card>
      </div>

      <div
        v-else
        class="flex items-center justify-center py-10 text-sm text-muted-foreground"
      >
        {{ $t("pages.system_metrics.no_nodes_found") }}
      </div>
    </Card>
  </PageTransition>

  <!-- Services section (now below game nodes) -->
  <PageTransition :delay="300" class="mt-8">
    <Card class="p-4 space-y-4">
      <div
        class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
      >
        <div class="flex items-center gap-2">
          <Cpu class="h-5 w-5 text-muted-foreground" />
          <h2 class="text-base font-semibold">
            {{ $t("pages.system_metrics.services") }}
          </h2>
        </div>

        <!-- Services filters -->
        <div class="flex flex-wrap gap-3 items-center">
          <div class="w-full sm:w-60">
            <Input
              v-model="serviceSearchTerm"
              :placeholder="
                $t('pages.system_metrics.search_services_placeholder')
              "
            />
          </div>
          <div class="w-full sm:w-48">
            <Select v-model="selectedServiceNode">
              <SelectTrigger>
                <SelectValue
                  :placeholder="$t('pages.system_metrics.filter_by_node')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">
                  {{ $t("common.all") }}
                </SelectItem>
                <SelectItem
                  v-for="node in uniqueServiceNodes"
                  :key="node"
                  :value="node"
                >
                  {{ node }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Sort services by</span>
            <Select v-model="serviceSortBy">
              <SelectTrigger class="h-7 w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpu">CPU</SelectItem>
                <SelectItem value="memory">Memory</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            <Select v-model="serviceSortDirection">
              <SelectTrigger class="h-7 w-24">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Desc</SelectItem>
                <SelectItem value="asc">Asc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator v-if="showSeparators" class="my-2" />

      <div
        v-if="filteredServices && filteredServices.length"
        class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <Card
          v-for="service in filteredServices"
          :key="`${service.node}-${service.name}`"
          :class="[
            'p-4 space-y-3',
            isServiceExpanded(service) ? 'md:col-span-2 xl:col-span-3' : '',
          ]"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1 flex-1 min-w-0">
              <div class="text-sm font-semibold truncate">
                {{ service.name }}
              </div>
              <div class="text-xs text-muted-foreground truncate">
                {{ service.node }}
              </div>
            </div>
            <div class="flex flex-col items-end gap-2 flex-shrink-0">
              <Badge
                v-if="serviceCpuStatus(service) !== 'normal'"
                :variant="
                  serviceCpuStatus(service) === 'critical'
                    ? 'destructive'
                    : 'outline'
                "
                class="text-xs"
              >
                {{
                  serviceCpuStatus(service) === "critical"
                    ? $t("pages.system_metrics.status_high_cpu")
                    : $t("pages.system_metrics.status_warning_cpu")
                }}
              </Badge>
              <div class="flex items-center gap-1">
                <FiveStackToolTip :delay-duration="300">
                  <template #trigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8"
                      @click="toggleServiceExpanded(service)"
                    >
                      <Activity
                        class="h-4 w-4"
                        :class="
                          isServiceExpanded(service) ? 'text-primary' : ''
                        "
                      />
                    </Button>
                  </template>
                  <span>
                    {{
                      isServiceExpanded(service)
                        ? $t("common.hide_metrics")
                        : $t("common.show_metrics")
                    }}
                  </span>
                </FiveStackToolTip>
                <FiveStackToolTip :delay-duration="300">
                  <template #trigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8"
                      @click="
                        $router.push({
                          path: '/system-logs',
                          query: { service: service.name },
                        })
                      "
                    >
                      <Logs class="h-4 w-4" />
                    </Button>
                  </template>
                  <span>{{ $t("layouts.app_nav.system.logs") }}</span>
                </FiveStackToolTip>
              </div>
            </div>
          </div>

          <!-- Compact quick view row -->
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">
                  {{ $t("pages.system_metrics.cpu_usage") }}
                </span>
                <span>{{ latestCpuUsage(service) }}%</span>
              </div>
              <div class="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary"
                  :style="{ width: `${latestCpuUsage(service)}%` }"
                />
              </div>
            </div>
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">
                  {{ $t("pages.system_metrics.memory_usage") }}
                </span>
                <span>{{ latestMemoryUsage(service) }}%</span>
              </div>
              <div class="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary/60"
                  :style="{ width: `${latestMemoryUsage(service)}%` }"
                />
              </div>
            </div>
          </div>

          <!-- Expanded detailed charts -->
          <div v-if="isServiceExpanded(service)" class="pt-2 border-t mt-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <h4 class="text-xs font-medium mb-2">
                  {{ $t("pages.system_metrics.cpu_usage") }}
                </h4>
                <div class="h-[260px]">
                  <CpuChart :metrics="service.cpu" />
                </div>
              </div>
              <div>
                <h4 class="text-xs font-medium mb-2">
                  {{ $t("pages.system_metrics.memory_usage") }}
                </h4>
                <div class="h-[260px]">
                  <MemoryChart :metrics="service.memory" label="MB" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div
        v-else
        class="flex items-center justify-center py-10 text-sm text-muted-foreground"
      >
        {{ $t("pages.system_metrics.no_services_found") }}
      </div>
    </Card>
  </PageTransition>
</template>

<script lang="ts">
export default {
  data() {
    return {
      // Services
      serviceSearchTerm: "",
      selectedServiceNode: "__all" as string,
      expandedServices: {} as Record<string, boolean>,
      serviceSortBy: "cpu" as "cpu" | "memory" | "name",
      serviceSortDirection: "desc" as "asc" | "desc",
      // Nodes
      nodeSearchTerm: "",
      onlyEnabledNodes: false,
      onlyOnlineNodes: true,
      expandedNodes: {} as Record<string, boolean>,
      nodeSortBy: "cpu" as "cpu" | "memory" | "name",
      nodeSortDirection: "desc" as "asc" | "desc",
      nodeMetricsCache: {} as Record<
        string,
        {
          cpu: number;
          memory: number;
        }
      >,
    };
  },
  methods: {
    hasServiceMetrics(service: any): boolean {
      return service.cpu.length > 0 || service.memory.length > 0;
    },
    serviceKey(service: any): string {
      return `${service.node}-${service.name}`;
    },
    isServiceExpanded(service: any): boolean {
      return !!this.expandedServices[this.serviceKey(service)];
    },
    toggleServiceExpanded(service: any) {
      const key = this.serviceKey(service);
      this.expandedServices[key] = !this.expandedServices[key];
    },
    latestCpuUsage(service: any): number {
      if (!service.cpu || !service.cpu.length) {
        return 0;
      }
      const last = service.cpu[service.cpu.length - 1];
      if (!last || !last.total || !last.used) {
        return 0;
      }
      // Align with CpuChart calculation:
      // used is nanocores, total is number of CPUs
      const coresUsed = last.used / 1_000_000_000;
      const usedPercent = (coresUsed * 100) / last.total;
      return Math.round(Math.min(100, Math.max(0, usedPercent)));
    },
    latestMemoryUsage(service: any): number {
      if (!service.memory || !service.memory.length) {
        return 0;
      }
      const last = service.memory[service.memory.length - 1];
      if (!last || !last.total) {
        return 0;
      }
      const usedPercent = (last.used / last.total) * 100;
      return Math.round(Math.min(100, Math.max(0, usedPercent)));
    },
    serviceCpuStatus(service: any): "normal" | "warning" | "critical" {
      const cpu = this.latestCpuUsage(service);
      if (cpu >= 90) {
        return "critical";
      }
      if (cpu >= 75) {
        return "warning";
      }
      return "normal";
    },
    isNodeExpanded(node: any): boolean {
      return !!this.expandedNodes[node.id];
    },
    toggleNodeExpanded(node: any) {
      this.expandedNodes[node.id] = !this.expandedNodes[node.id];
    },
    updateNodeMetrics(payload: {
      nodeId: string;
      cpu: number;
      memory: number;
    }) {
      this.nodeMetricsCache[payload.nodeId] = {
        cpu: payload.cpu,
        memory: payload.memory,
      };
    },
  },
  watch: {
    serviceSortBy(newVal: "cpu" | "memory" | "name") {
      this.serviceSortDirection = newVal === "name" ? "asc" : "desc";
    },
    nodeSortBy(newVal: "cpu" | "memory" | "name") {
      this.nodeSortDirection = newVal === "name" ? "asc" : "desc";
    },
  },
  computed: {
    totalServices(): number {
      return (this.getServiceStats && this.getServiceStats.length) || 0;
    },
    totalGameNodes(): number {
      return (this.game_server_nodes && this.game_server_nodes.length) || 0;
    },
    uniqueServiceNodes(): string[] {
      if (!this.getServiceStats) {
        return [];
      }
      const nodes = new Set<string>();
      this.getServiceStats.forEach((s: any) => {
        if (s.node) {
          nodes.add(s.node);
        }
      });
      return Array.from(nodes).sort();
    },
    filteredServices(): any[] {
      if (!this.getServiceStats) {
        return [];
      }
      const term = this.serviceSearchTerm.trim().toLowerCase();
      const filtered = this.getServiceStats.filter((service: any) => {
        if (!this.hasServiceMetrics(service)) {
          return false;
        }
        if (
          term &&
          !`${service.name} ${service.node}`.toLowerCase().includes(term)
        ) {
          return false;
        }
        if (
          this.selectedServiceNode !== "__all" &&
          service.node !== this.selectedServiceNode
        ) {
          return false;
        }
        return true;
      });

      const services = [...filtered];
      const directionFactor = this.serviceSortDirection === "asc" ? 1 : -1;

      services.sort((a: any, b: any) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        if (this.serviceSortBy === "cpu") {
          valA = this.latestCpuUsage(a);
          valB = this.latestCpuUsage(b);
        } else if (this.serviceSortBy === "memory") {
          valA = this.latestMemoryUsage(a);
          valB = this.latestMemoryUsage(b);
        } else if (this.serviceSortBy === "name") {
          valA = (a.name || "") as string;
          valB = (b.name || "") as string;
        }

        if (typeof valA === "string" && typeof valB === "string") {
          return directionFactor * valA.localeCompare(valB);
        }

        const numA = typeof valA === "number" ? valA : 0;
        const numB = typeof valB === "number" ? valB : 0;
        if (numA === numB) return 0;
        return directionFactor * (numA < numB ? -1 : 1);
      });

      return services;
    },
    filteredNodes(): any[] {
      if (!this.game_server_nodes) {
        return [];
      }
      const term = this.nodeSearchTerm.trim().toLowerCase();
      const filtered = this.game_server_nodes.filter((node: any) => {
        if (
          term &&
          !`${node.label || ""} ${node.id} ${node.region || ""}`
            .toLowerCase()
            .includes(term)
        ) {
          return false;
        }
        if (this.onlyEnabledNodes && !node.enabled) {
          return false;
        }
        if (this.onlyOnlineNodes && node.offline_at) {
          return false;
        }
        return true;
      });

      const nodes = [...filtered];
      const directionFactor = this.nodeSortDirection === "asc" ? 1 : -1;

      nodes.sort((a: any, b: any) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        if (this.nodeSortBy === "cpu" || this.nodeSortBy === "memory") {
          const metricsA = this.nodeMetricsCache[a.id];
          const metricsB = this.nodeMetricsCache[b.id];
          const key = this.nodeSortBy;

          const defaultVal =
            this.nodeSortDirection === "asc" ? Number.POSITIVE_INFINITY : -1;

          valA = metricsA ? (metricsA[key] ?? defaultVal) : defaultVal;
          valB = metricsB ? (metricsB[key] ?? defaultVal) : defaultVal;
        } else if (this.nodeSortBy === "name") {
          const nameA = (a.label || a.id || "") as string;
          const nameB = (b.label || b.id || "") as string;
          valA = nameA;
          valB = nameB;
        }

        if (typeof valA === "string" && typeof valB === "string") {
          return directionFactor * valA.localeCompare(valB);
        }

        const numA = typeof valA === "number" ? valA : 0;
        const numB = typeof valB === "number" ? valB : 0;
        if (numA === numB) return 0;
        return directionFactor * (numA < numB ? -1 : 1);
      });

      return nodes;
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
            cpu: [
              {},
              {
                time: true,
                total: true,
                used: true,
                window: true,
              },
            ],
            memory: [
              {},
              {
                time: true,
                total: true,
                used: true,
              },
            ],
          },
        ],
      }),
      pollInterval: 30 * 1000,
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
          },
        ],
      }),
      pollInterval: 30 * 1000,
    },
  },
};
</script>
