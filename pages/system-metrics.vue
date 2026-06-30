<script setup lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import CpuChart from "~/components/charts/CpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import NodeMetrics from "~/components/system-metrics/NodeMetrics.vue";
import NodeGpuMetrics from "~/components/system-metrics/NodeGpuMetrics.vue";
import NodeQuickStats from "~/components/system-metrics/NodeQuickStats.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowUpZA,
  ChevronDown,
  Cpu,
  HardDrive,
  Logs,
  Search,
  Signal,
} from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
</script>

<template>
  <div class="relative space-y-8 [--tac-clip:14px] [--tac-clip-sm:10px]">
    <PageTransition :delay="0">
      <section class="space-y-4">
        <header
          class="flex flex-col gap-3 border-b border-border/60 pb-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="flex items-center gap-3">
            <span
              class="inline-block h-[2px] w-[14px] bg-[hsl(var(--tac-amber))]"
            />
            <div>
              <h2
                class="font-sans text-lg font-bold uppercase tracking-[0.08em]"
              >
                {{ $t("pages.game_server_nodes.title") }}
                <span
                  class="ml-2 font-mono text-xs font-normal tracking-[0.15em] text-[hsl(var(--tac-amber))]"
                >
                  [ {{ filteredNodes.length }} / {{ totalGameNodes }} ]
                </span>
              </h2>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div class="relative w-full sm:w-64">
              <Search
                class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--tac-amber))]"
              />
              <Input
                v-model="nodeSearchTerm"
                class="h-9 border-border bg-background/60 pl-8 font-mono text-xs tracking-wider placeholder:text-muted-foreground/60 focus-visible:border-[hsl(var(--tac-amber))] focus-visible:ring-0"
                :placeholder="
                  $t('pages.system_metrics.search_nodes_placeholder')
                "
              />
            </div>

            <div class="flex items-center gap-2">
              <Switch v-model="onlyEnabledNodes" />
              <Label class="text-sm cursor-pointer">
                {{ $t("pages.game_server_nodes.only_enabled") }}
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <Switch v-model="onlyOnlineNodes" />
              <Label class="text-sm cursor-pointer">
                {{ $t("pages.system_metrics.only_online_nodes") }}
              </Label>
            </div>

            <div
              class="flex h-9 items-center gap-1 border border-border bg-background/40 px-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              <span class="pl-1">sort</span>
              <Select v-model="nodeSortBy">
                <SelectTrigger
                  class="h-7 w-20 border-none bg-transparent px-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] shadow-none transition-colors hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))] focus:ring-0 [&[data-state=open]]:bg-[hsl(var(--tac-amber)/0.16)] [&[data-state=open]]:text-[hsl(var(--tac-amber))]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpu">CPU</SelectItem>
                  <SelectItem value="memory">MEM</SelectItem>
                  <SelectItem value="name">{{
                    $t("system_metrics.col_name")
                  }}</SelectItem>
                </SelectContent>
              </Select>
              <FiveStackToolTip>
                <template #trigger>
                  <button
                    class="grid h-6 w-6 place-items-center border border-border text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.12)]"
                    @click="
                      nodeSortDirection =
                        nodeSortDirection === 'asc' ? 'desc' : 'asc'
                    "
                  >
                    <component
                      :is="sortIconFor(nodeSortBy, nodeSortDirection)"
                      class="h-3 w-3"
                    />
                  </button>
                </template>
                <span>
                  {{
                    nodeSortDirection === "asc"
                      ? $t("common.sort_ascending")
                      : $t("common.sort_descending")
                  }}
                </span>
              </FiveStackToolTip>
            </div>
          </div>
        </header>

        <div>
          <div
            v-if="filteredNodes && filteredNodes.length"
            class="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <article
              v-for="(node, idx) in filteredNodes"
              :key="node.id"
              :class="[
                'group relative border border-border bg-background/40 p-4',
                isNodeExpanded(node)
                  ? 'border-[hsl(var(--tac-amber)/0.55)] md:col-span-2'
                  : '',
              ]"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div
                    class="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.22em]"
                  >
                    <span class="flex items-center gap-1.5">
                      <span
                        class="inline-block h-1.5 w-1.5"
                        :class="
                          isNodeOnline(node)
                            ? 'bg-emerald-500 shadow-[0_0_8px_hsl(142_71%_45%/0.6)]'
                            : 'bg-amber-500'
                        "
                      />
                      <span
                        :class="
                          isNodeOnline(node)
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                        "
                      >
                        {{ isNodeOnline(node) ? "online" : "offline" }}
                      </span>
                    </span>
                    <span class="text-border">//</span>
                    <span
                      :class="
                        node.enabled
                          ? 'text-foreground'
                          : 'text-muted-foreground line-through'
                      "
                    >
                      {{
                        node.enabled
                          ? $t("common.enabled")
                          : $t("common.disabled")
                      }}
                    </span>
                  </div>

                  <div
                    class="mt-1.5 truncate font-sans text-base font-semibold tracking-tight"
                  >
                    {{ nodeDisplayName(node) }}
                  </div>
                  <div
                    class="truncate font-mono text-[11px] text-muted-foreground"
                  >
                    {{ nodeSubtitle(node) }}
                  </div>
                </div>

                <FiveStackToolTip>
                  <template #trigger>
                    <button
                      class="grid h-9 w-9 place-items-center border transition-colors"
                      :class="
                        isNodeExpanded(node)
                          ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]'
                          : 'border-border bg-background/60 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))]'
                      "
                      @click="toggleNodeExpanded(node)"
                    >
                      <Signal class="h-4 w-4" />
                    </button>
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

              <div class="mt-4">
                <NodeQuickStats
                  :node-id="node.id"
                  @update-latest-metrics="updateNodeMetrics"
                />
              </div>

              <div
                v-if="isNodeExpanded(node)"
                class="mt-4 border border-border/60 bg-background/30 p-3 sm:p-4"
              >
                <NodeMetrics :game-server-node="node" />
              </div>
            </article>
          </div>

          <div
            v-else
            class="flex items-center justify-center gap-2 py-10 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-muted-foreground"
          >
            <span class="text-[hsl(var(--tac-amber))]">◇</span>
            {{ $t("pages.system_metrics.no_nodes_found") }}
          </div>
        </div>
      </section>
    </PageTransition>

    <PageTransition v-if="gpuNodes.length" :delay="40">
      <section class="space-y-4">
        <header
          class="flex flex-col gap-3 border-b border-border/60 pb-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="flex items-center gap-3">
            <span
              class="inline-block h-[2px] w-[14px] bg-[hsl(var(--tac-amber))]"
            />
            <div>
              <h2
                class="font-sans text-lg font-bold uppercase tracking-[0.08em]"
              >
                GPUs
                <span
                  class="ml-2 font-mono text-xs font-normal tracking-[0.15em] text-[hsl(var(--tac-amber))]"
                >
                  [ {{ gpuNodes.length }} ]
                </span>
              </h2>
            </div>
          </div>
        </header>

        <div>
          <div class="border border-border">
            <div
              v-for="(node, idx) in gpuNodes"
              :key="`gpu-${node.id}`"
              class="border-b border-border/50 bg-background/40 p-4 last:border-b-0"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <NuxtLink
                    :to="`/game-server-nodes`"
                    class="truncate font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                  >
                    {{ nodeDisplayName(node) }}
                  </NuxtLink>
                  <div
                    class="mt-1 truncate font-sans text-sm font-semibold tracking-tight"
                  >
                    {{ gpuDevicesLabel(node) }}
                  </div>
                </div>

                <FiveStackToolTip>
                  <template #trigger>
                    <button
                      class="grid h-8 w-8 shrink-0 place-items-center border transition-colors"
                      :class="
                        isGpuExpanded(node)
                          ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]'
                          : 'border-border bg-background/60 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))]'
                      "
                      @click="toggleGpuExpanded(node)"
                    >
                      <ChevronDown
                        class="h-4 w-4 transition-transform"
                        :class="isGpuExpanded(node) ? 'rotate-180' : ''"
                      />
                    </button>
                  </template>
                  <span>
                    {{
                      isGpuExpanded(node)
                        ? $t("common.hide_metrics")
                        : $t("common.show_metrics")
                    }}
                  </span>
                </FiveStackToolTip>
              </div>

              <NodeGpuMetrics
                class="mt-3"
                :node-id="node.id"
                :show-label="false"
                :show-quick-stats="true"
                :show-charts="isGpuExpanded(node)"
              />
            </div>
          </div>
        </div>
      </section>
    </PageTransition>

    <PageTransition :delay="60">
      <section class="space-y-4">
        <header
          class="flex flex-col gap-3 border-b border-border/60 pb-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="flex items-center gap-3">
            <span
              class="inline-block h-[2px] w-[14px] bg-[hsl(var(--tac-amber))]"
            />
            <div>
              <h2
                class="font-sans text-lg font-bold uppercase tracking-[0.08em]"
              >
                {{ $t("pages.system_metrics.services") }}
                <span
                  class="ml-2 font-mono text-xs font-normal tracking-[0.15em] text-[hsl(var(--tac-amber))]"
                >
                  [ {{ totalServices }} ]
                </span>
              </h2>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div class="relative w-full sm:w-64">
              <Search
                class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--tac-amber))]"
              />
              <Input
                v-model="serviceSearchTerm"
                class="h-9 border-border bg-background/60 pl-8 font-mono text-xs tracking-wider placeholder:text-muted-foreground/60 focus-visible:border-[hsl(var(--tac-amber))] focus-visible:ring-0"
                :placeholder="
                  $t('pages.system_metrics.search_services_placeholder')
                "
              />
            </div>

            <Select v-model="selectedServiceNode">
              <SelectTrigger
                class="h-9 w-44 border-border bg-background/40 font-mono text-[0.65rem] uppercase tracking-[0.18em] shadow-none transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))] focus:ring-0 [&[data-state=open]]:border-[hsl(var(--tac-amber))] [&[data-state=open]]:text-[hsl(var(--tac-amber))]"
              >
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

            <div
              class="flex h-9 items-center gap-1 border border-border bg-background/40 px-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              <span class="pl-1">sort</span>
              <Select v-model="serviceSortBy">
                <SelectTrigger
                  class="h-7 w-20 border-none bg-transparent px-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] shadow-none transition-colors hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))] focus:ring-0 [&[data-state=open]]:bg-[hsl(var(--tac-amber)/0.16)] [&[data-state=open]]:text-[hsl(var(--tac-amber))]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpu">CPU</SelectItem>
                  <SelectItem value="memory">MEM</SelectItem>
                  <SelectItem value="name">{{
                    $t("system_metrics.col_name")
                  }}</SelectItem>
                </SelectContent>
              </Select>
              <FiveStackToolTip>
                <template #trigger>
                  <button
                    class="grid h-6 w-6 place-items-center border border-border text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.12)]"
                    @click="
                      serviceSortDirection =
                        serviceSortDirection === 'asc' ? 'desc' : 'asc'
                    "
                  >
                    <component
                      :is="sortIconFor(serviceSortBy, serviceSortDirection)"
                      class="h-3 w-3"
                    />
                  </button>
                </template>
                <span>
                  {{
                    serviceSortDirection === "asc"
                      ? $t("common.sort_ascending")
                      : $t("common.sort_descending")
                  }}
                </span>
              </FiveStackToolTip>
            </div>
          </div>
        </header>

        <div>
          <div
            v-if="filteredServices && filteredServices.length"
            class="border border-border"
          >
            <div
              class="hidden gap-4 border-b border-border/70 bg-background/40 px-4 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_4rem] sm:items-center"
            >
              <button
                class="flex items-center gap-1.5 text-left uppercase tracking-[0.2em] transition-colors hover:text-[hsl(var(--tac-amber))]"
                :class="
                  serviceSortBy === 'name' ? 'text-[hsl(var(--tac-amber))]' : ''
                "
                @click="setServiceSort('name')"
              >
                {{ $t("pages.system_metrics.service") }}
                <component
                  :is="sortIconFor('name', serviceSortDirection)"
                  v-if="serviceSortBy === 'name'"
                  class="h-3 w-3"
                />
              </button>
              <span>node</span>
              <button
                class="flex items-center gap-1.5 text-left uppercase tracking-[0.2em] transition-colors hover:text-[hsl(var(--tac-amber))]"
                :class="
                  serviceSortBy === 'cpu' ? 'text-[hsl(var(--tac-amber))]' : ''
                "
                @click="setServiceSort('cpu')"
              >
                <Cpu class="h-3 w-3" />
                {{ $t("pages.system_metrics.cpu_short") }}
                <component
                  :is="sortIconFor('cpu', serviceSortDirection)"
                  v-if="serviceSortBy === 'cpu'"
                  class="h-3 w-3"
                />
              </button>
              <button
                class="flex items-center gap-1.5 text-left uppercase tracking-[0.2em] transition-colors hover:text-[hsl(var(--tac-amber))]"
                :class="
                  serviceSortBy === 'memory'
                    ? 'text-[hsl(var(--tac-amber))]'
                    : ''
                "
                @click="setServiceSort('memory')"
              >
                <HardDrive class="h-3 w-3" />
                {{ $t("pages.system_metrics.memory_short") }}
                <component
                  :is="sortIconFor('memory', serviceSortDirection)"
                  v-if="serviceSortBy === 'memory'"
                  class="h-3 w-3"
                />
              </button>
              <span />
            </div>

            <template
              v-for="service in filteredServices"
              :key="`${service.node}-${service.name}`"
            >
              <div
                :class="[
                  'items-center gap-3 border-b border-l-2 border-border/40 px-4 py-3 transition-colors last:border-b-0 hover:bg-[hsl(var(--tac-amber)/0.04)] sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_4rem] sm:gap-4',
                  serviceCpuStatus(service) === 'critical'
                    ? 'border-l-destructive'
                    : serviceCpuStatus(service) === 'warning'
                      ? 'border-l-[hsl(var(--tac-amber))]'
                      : 'border-l-transparent',
                ]"
              >
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold tracking-tight">
                    {{ service.name }}
                  </div>
                  <div
                    class="truncate font-mono text-[10px] text-muted-foreground sm:hidden"
                  >
                    {{ service.node }}
                  </div>
                </div>

                <div
                  class="hidden min-w-0 truncate font-mono text-[11px] text-muted-foreground sm:block"
                >
                  {{ service.node }}
                </div>

                <div class="mt-2 flex items-center gap-2 sm:mt-0">
                  <span
                    class="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground sm:hidden"
                  >
                    CPU
                  </span>
                  <div class="h-1.5 flex-1 overflow-hidden bg-border/30">
                    <div
                      class="h-full"
                      :class="serviceCpuBarClass(service)"
                      :style="{ width: `${latestCpuUsage(service)}%` }"
                    />
                  </div>
                  <span
                    class="w-9 shrink-0 text-right text-xs font-semibold tabular-nums"
                    :class="{
                      'text-destructive':
                        serviceCpuStatus(service) === 'critical',
                      'text-[hsl(var(--tac-amber))]':
                        serviceCpuStatus(service) === 'warning',
                    }"
                  >
                    {{ String(latestCpuUsage(service)).padStart(2, "0") }}%
                  </span>
                </div>

                <div
                  class="mt-2 flex items-center gap-2 sm:mt-0"
                  :title="serviceMemoryUsageLabel(service)"
                >
                  <span
                    class="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground sm:hidden"
                  >
                    MEM
                  </span>
                  <div class="h-1.5 flex-1 overflow-hidden bg-border/30">
                    <div
                      class="h-full"
                      :class="serviceMemBarClass(service)"
                      :style="{ width: `${latestMemoryUsage(service)}%` }"
                    />
                  </div>
                  <span
                    class="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground"
                  >
                    {{ String(latestMemoryUsage(service)).padStart(2, "0") }}%
                  </span>
                </div>

                <div class="mt-3 flex items-center justify-end gap-1 sm:mt-0">
                  <FiveStackToolTip>
                    <template #trigger>
                      <button
                        class="grid h-7 w-7 place-items-center border transition-colors"
                        :class="
                          isServiceExpanded(service)
                            ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]'
                            : 'border-border bg-background/60 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))]'
                        "
                        @click="toggleServiceExpanded(service)"
                      >
                        <ChevronDown
                          class="h-3.5 w-3.5 transition-transform"
                          :class="isServiceExpanded(service) ? 'rotate-180' : ''"
                        />
                      </button>
                    </template>
                    <span>
                      {{
                        isServiceExpanded(service)
                          ? $t("common.hide_metrics")
                          : $t("common.show_metrics")
                      }}
                    </span>
                  </FiveStackToolTip>
                  <FiveStackToolTip>
                    <template #trigger>
                      <button
                        class="grid h-7 w-7 place-items-center border border-border bg-background/60 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))]"
                        @click="
                          $router.push({
                            path: '/system-logs',
                            query: { tab: service.name },
                          })
                        "
                      >
                        <Logs class="h-3.5 w-3.5" />
                      </button>
                    </template>
                    <span>{{ $t("layouts.app_nav.system.logs") }}</span>
                  </FiveStackToolTip>
                </div>
              </div>

              <div
                v-if="isServiceExpanded(service)"
                class="border-b border-border/40 bg-background/20 p-4 last:border-b-0 sm:px-5"
              >
                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <div
                      class="mb-2 flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
                    >
                      <span
                        class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
                      />
                      {{ $t("pages.system_metrics.cpu_usage") }}
                    </div>
                    <div class="h-[240px]">
                      <CpuChart :metrics="service.cpu" />
                    </div>
                  </div>
                  <div>
                    <div
                      class="mb-2 flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
                    >
                      <span
                        class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
                      />
                      {{ $t("pages.system_metrics.memory_usage") }}
                    </div>
                    <div class="h-[240px]">
                      <MemoryChart :metrics="service.memory" label="MB" />
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div
            v-else
            class="flex items-center justify-center gap-2 py-10 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-muted-foreground"
          >
            <span class="text-[hsl(var(--tac-amber))]">◇</span>
            {{ $t("pages.system_metrics.no_services_found") }}
          </div>
        </div>
      </section>
    </PageTransition>
  </div>
</template>

<script lang="ts">
import { formatUsedOverTotalBytes } from "~/utilities/formatResourceUsage";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowUpZA,
} from "lucide-vue-next";

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
      // GPUs
      expandedGpus: {} as Record<string, boolean>,
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
    sortIconFor(sortBy: "cpu" | "memory" | "name", direction: "asc" | "desc") {
      if (sortBy === "name") {
        return direction === "asc" ? ArrowDownAZ : ArrowUpZA;
      }
      return direction === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow;
    },
    hasServiceMetrics(service: any): boolean {
      return service.cpu.length > 0 || service.memory.length > 0;
    },
    nodeDisplayName(node: any): string {
      return node.label || node.id;
    },
    nodeSubtitle(node: any): string {
      return node.region ? `${node.region} · ${node.id}` : node.id;
    },
    gpuDevicesLabel(node: any): string {
      const devices = Array.isArray(node?.gpu_info) ? node.gpu_info : [];
      if (!devices.length) return this.$t("game_server.gpu_present");
      return devices
        .map((d: any) => {
          const name = d?.name || `GPU ${d?.index ?? "?"}`;
          if (d?.memory_mb) {
            const mem =
              d.memory_mb >= 1024
                ? `${(d.memory_mb / 1024).toFixed(1)} GB`
                : `${d.memory_mb} MB`;
            return `${name} · ${mem}`;
          }
          return name;
        })
        .join(", ");
    },
    isNodeOnline(node: any): boolean {
      return !node.offline_at;
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
    serviceMemoryUsageLabel(service: any): string {
      if (!service.memory || !service.memory.length) {
        return "—";
      }
      const last = service.memory[service.memory.length - 1];
      if (!last || !last.total) {
        return "—";
      }
      return formatUsedOverTotalBytes(
        Number(last.used || 0),
        Number(last.total),
      );
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
    setServiceSort(field: "cpu" | "memory" | "name") {
      if (this.serviceSortBy === field) {
        this.serviceSortDirection =
          this.serviceSortDirection === "asc" ? "desc" : "asc";
      } else {
        this.serviceSortBy = field;
      }
    },
    serviceCpuBarClass(service: any): string {
      const cpu = this.latestCpuUsage(service);
      if (cpu >= 85) return "bg-destructive";
      if (cpu >= 70) return "bg-[hsl(var(--tac-amber))]";
      return "bg-emerald-500/90";
    },
    serviceMemBarClass(service: any): string {
      const mem = this.latestMemoryUsage(service);
      if (mem >= 85) return "bg-destructive/90";
      return "bg-[hsl(var(--tac-amber)/0.7)]";
    },
    serviceCpuStateLabel(service: any): string {
      const status = this.serviceCpuStatus(service);
      if (status === "critical") {
        return "critical";
      }
      if (status === "warning") {
        return "elevated";
      }
      return "stable";
    },
    isNodeExpanded(node: any): boolean {
      return !!this.expandedNodes[node.id];
    },
    toggleNodeExpanded(node: any) {
      this.expandedNodes[node.id] = !this.expandedNodes[node.id];
    },
    isGpuExpanded(node: any): boolean {
      return !!this.expandedGpus[node.id];
    },
    toggleGpuExpanded(node: any) {
      this.expandedGpus[node.id] = !this.expandedGpus[node.id];
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
    onlineNodesCount(): number {
      if (!this.game_server_nodes) {
        return 0;
      }
      return this.game_server_nodes.filter((node: any) => !node.offline_at)
        .length;
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
    topService(): any | null {
      if (!this.filteredServices.length) {
        return null;
      }

      return this.filteredServices.reduce((best: any, service: any) => {
        if (!best) {
          return service;
        }
        return this.latestCpuUsage(service) > this.latestCpuUsage(best)
          ? service
          : best;
      }, null);
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
    gpuNodes(): any[] {
      if (!this.game_server_nodes) return [];
      return this.game_server_nodes
        .filter((node: any) => {
          if (!node.gpu) return false;
          if (this.onlyEnabledNodes && !node.enabled) return false;
          if (this.onlyOnlineNodes && node.offline_at) return false;
          return true;
        })
        .sort((a: any, b: any) => {
          const nameA = (a.label || a.id || "") as string;
          const nameB = (b.label || b.id || "") as string;
          return nameA.localeCompare(nameB);
        });
    },
    topNode(): any | null {
      if (!this.filteredNodes.length) {
        return null;
      }

      return this.filteredNodes.reduce((best: any, node: any) => {
        const bestCpu = best ? (this.nodeMetricsCache[best.id]?.cpu ?? -1) : -1;
        const nodeCpu = this.nodeMetricsCache[node.id]?.cpu ?? -1;
        return nodeCpu > bestCpu ? node : best;
      }, null);
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
            gpu: true,
            gpu_info: true,
          },
        ],
      }),
      pollInterval: 30 * 1000,
    },
  },
};
</script>
