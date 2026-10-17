<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronDown, CircleAlert, Logs, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import SortHeader from "~/components/admin/SortHeader.vue";
import { TONE_TEXT } from "~/components/admin/tone";
import { useListKeyboard } from "~/composables/useListKeyboard";
import Fold from "~/components/ui/transitions/Fold.vue";
import NodeLoadStack from "~/components/game-server-nodes/NodeLoadStack.vue";
import NodeSpark from "~/components/game-server-nodes/NodeSpark.vue";
import ServiceCharts from "~/components/system-metrics/ServiceCharts.vue";
import type { DiskSize } from "~/components/game-server-nodes/nodeInspector";
import { dateLocale } from "~/utilities/dateLocale";
import {
  CRIT,
  level,
  memoryShareLevel,
  toneOf,
  WARN,
  type NodeDisk,
  type ServiceRow,
  type ServiceSortKey,
  type ServiceStat,
} from "~/components/system-metrics/metricRules";

const props = defineProps<{
  rows: ServiceRow[];
  sortKey: ServiceSortKey;
  sortDir: "asc" | "desc";
  now: number;
}>();

const emit = defineEmits<{
  (e: "sort", key: ServiceSortKey): void;
  (e: "logs", service: ServiceStat): void;
}>();

const { t } = useI18n();

const expanded = ref(new Set<string>());

// The whole row opens its charts; buttons inside it (logs) keep their own job.
function onRowClick(event: MouseEvent, key: string) {
  if ((event.target as HTMLElement).closest("button, a, input, select")) {
    return;
  }
  toggle(key);
}

function toggle(key: string) {
  const next = new Set(expanded.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expanded.value = next;
}

// ↑/↓ move between services, Enter opens the charts, Esc folds them.
const wrap = ref<HTMLElement | null>(null);
const activeId = ref<string | null>(null);
const { rowProps } = useListKeyboard({
  items: () => props.rows,
  getId: (row) => row.key,
  activeId,
  container: wrap,
  onOpen: toggle,
  onClose: () => {
    const id = activeId.value;
    if (id && expanded.value.has(id)) {
      toggle(id);
      return true;
    }
  },
});

// aria-expanded already says what the row does.
function rowAttrs(key: string) {
  const { "aria-selected": _selected, ...rest } = rowProps(key);
  return rest;
}

// Leaving the table hands the arrow keys back to the page.
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  if (!next || !wrap.value?.contains(next)) {
    activeId.value = null;
  }
}

// CPU, memory share and the node's disk share one Load column; its header
// sorts by each.
const loadSecondary = computed(() => [
  {
    key: "memory",
    label: t("pages.system_metrics.memory_short"),
    tip: t("pages.system_metrics.services_table.memory_share_hint"),
  },
  {
    key: "disk",
    label: t("pages.system_metrics.services_table.node_disk"),
    tip: t("pages.system_metrics.services_table.node_disk_hint"),
  },
]);

const hhmm = (t: number | null) =>
  t == null
    ? "—"
    : new Date(t).toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
      });

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function memoryAmount(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "—";
  }
  return bytes >= GB
    ? `${(bytes / GB).toFixed(1)} GB`
    : `${Math.round(bytes / MB)} MB`;
}

// The node disk reads warning from 75%, critical from 90%, like the rest.
const DISK_LEVELS = { warning: WARN, critical: CRIT };

const diskSize = (disk: NodeDisk | null): DiskSize | null =>
  disk && {
    percent: disk.pct,
    usedGb: disk.usedBytes / GB,
    totalGb: disk.totalBytes / GB,
    freeGb: Math.max(0, disk.totalBytes - disk.usedBytes) / GB,
  };
</script>

<template>
  <div class="sm-list">
    <div ref="wrap" class="sm-wrap" @focusout="onFocusOut">
      <table class="sm-table">
        <thead>
          <tr>
            <SortHeader
              class="sm-c-name"
              sort-key="name"
              :label="$t('pages.system_metrics.service')"
              :active="sortKey"
              :dir="sortDir"
              @sort="emit('sort', $event as ServiceSortKey)"
            />
            <SortHeader
              class="sm-c-load"
              sort-key="cpu"
              :label="$t('pages.system_metrics.cpu_short')"
              :secondary="loadSecondary"
              :active="sortKey"
              :dir="sortDir"
              @sort="emit('sort', $event as ServiceSortKey)"
            />
            <th class="sm-c-spark">
              {{ $t("pages.system_metrics.services_table.cpu_last_30") }}
            </th>
            <th class="sm-c-act">
              <span class="sr-only">{{
                $t("pages.system_metrics.services_table.actions")
              }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in rows" :key="row.key">
            <tr
              class="sm-row"
              v-bind="rowAttrs(row.key)"
              :data-stale="row.stale"
              :data-open="expanded.has(row.key)"
              :aria-expanded="expanded.has(row.key)"
              @click="onRowClick($event, row.key)"
              @keydown.space.self.prevent="toggle(row.key)"
            >
              <!-- The severity rail sits on the first cell: a box-shadow on a
                   table row is not painted. -->
              <td
                class="sm-c-name"
                :data-rail="row.stale ? undefined : (row.severity ?? undefined)"
              >
                <div class="flex min-w-0 items-center gap-2">
                  <ChevronDown
                    class="sm-chev h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    :class="
                      expanded.has(row.key) && 'rotate-180 text-foreground'
                    "
                    aria-hidden="true"
                  />
                  <div class="grid min-w-0 gap-0.5">
                    <span class="flex min-w-0 items-center gap-1.5">
                      <span
                        class="truncate"
                        :class="row.stale ? 'font-medium' : 'font-semibold'"
                        :title="row.service.name"
                      >
                        {{ row.service.name }}
                      </span>
                      <template v-if="!row.stale && row.severity">
                        <CircleAlert
                          v-if="row.severity === 'critical'"
                          class="h-3.5 w-3.5 shrink-0 text-destructive"
                          :aria-label="$t('system_alerts.types.critical')"
                        />
                        <TriangleAlert
                          v-else
                          class="h-3.5 w-3.5 shrink-0"
                          :class="TONE_TEXT.warn"
                          :aria-label="$t('system_alerts.types.warning')"
                        />
                      </template>
                    </span>
                    <span
                      class="truncate text-[11px] text-muted-foreground/70"
                      :class="row.nodeIsId && 'font-mono'"
                      :title="row.service.node"
                    >
                      {{ row.nodeShort }}
                    </span>
                  </div>
                </div>
              </td>

              <td class="sm-c-load">
                <span
                  v-if="row.stale"
                  class="mb-[3px] block whitespace-nowrap text-xs"
                >
                  {{
                    $t("pages.system_metrics.services_table.last_seen", {
                      time: hhmm(row.lastSeen),
                    })
                  }}
                </span>
                <NodeLoadStack
                  v-if="!row.stale || row.disk"
                  :class="row.stale && 'opacity-60'"
                  :live="!row.stale"
                  :cpu="row.cpu"
                  :memory="row.share"
                  :disk="diskSize(row.disk)"
                  :disk-thresholds="DISK_LEVELS"
                  :cpu-tone="toneOf(level(row.cpu))"
                  :memory-tone="toneOf(memoryShareLevel(row.share))"
                  precise
                >
                  <template #memory-tip>
                    <span class="tabular-nums"
                      >{{ memoryAmount(row.memoryBytes) }} ({{
                        pct(row.share)
                      }})</span
                    >
                  </template>
                  <template #disk-tip="{ tip }">
                    <span class="grid gap-0.5">
                      <span class="tabular-nums">{{ tip }}</span>
                      <span class="font-mono text-[11px] opacity-70">
                        {{
                          [row.disk?.mount, row.nodeLabel]
                            .filter(Boolean)
                            .join(" · ")
                        }}
                      </span>
                    </span>
                  </template>
                </NodeLoadStack>
              </td>

              <td class="sm-c-spark" :class="row.stale && 'opacity-40'">
                <NodeSpark
                  :points="row.spark.points"
                  :from="row.spark.from"
                  :to="row.spark.to"
                  tone="cpu"
                />
              </td>

              <td class="sm-c-act">
                <div class="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    :aria-label="
                      $t('pages.system_metrics.logs_for', {
                        name: row.service.name,
                      })
                    "
                    @click="emit('logs', row.service)"
                  >
                    <Logs />
                  </Button>
                </div>
              </td>
            </tr>
            <tr class="sm-fold" :data-open="expanded.has(row.key)">
              <td colspan="4">
                <Fold :open="expanded.has(row.key)">
                  <div class="px-3 pb-4 pt-1">
                    <ServiceCharts :service="row.service" :now="now" />
                  </div>
                </Fold>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.sm-list {
  container: sm-list / inline-size;
  min-width: 0;
}
.sm-wrap {
  overflow-x: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: hsl(var(--card) / 0.3);
}
.sm-table {
  width: 100%;
  min-width: 480px;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}
.sm-table th {
  padding: 9px 12px;
  border-bottom: 1px solid hsl(var(--border));
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}
.sm-row {
  cursor: pointer;
}
.sm-row:focus-visible {
  outline: 2px solid hsl(var(--tac-amber) / 0.5);
  outline-offset: -2px;
}
.sm-row td {
  height: 54px;
  padding: 6px 12px;
  border-bottom: 1px solid hsl(var(--border) / 0.6);
  vertical-align: middle;
  transition: background-color 120ms ease;
}
.sm-row:hover td {
  background: hsl(240 4% 8.5%);
}
.sm-row[data-stale="true"] td {
  color: hsl(var(--muted-foreground));
}
/* An open row's charts belong to it: the line moves below the fold. */
.sm-row[data-open="true"] td {
  border-bottom-color: transparent;
}
.sm-fold td {
  padding: 0;
}
.sm-fold[data-open="true"] td {
  border-bottom: 1px solid hsl(var(--border) / 0.6);
}
.sm-table tbody > tr.sm-row:nth-last-child(2) td {
  border-bottom-color: transparent;
}
.sm-table tbody > tr.sm-fold:last-child td {
  border-bottom: 0;
}
.sm-row td[data-rail="critical"] {
  box-shadow: inset 2px 0 0 hsl(var(--destructive));
}
.sm-row td[data-rail="warning"] {
  box-shadow: inset 2px 0 0 hsl(var(--warning));
}
.sm-chev {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.sm-table .sm-c-load {
  width: 216px;
}
.sm-table .sm-c-spark {
  width: 136px;
}
.sm-table .sm-c-act {
  width: 48px;
  padding-left: 0;
}
/* The spark goes first on a narrow list; the load stays. */
@container sm-list (max-width: 820px) {
  .sm-table .sm-c-spark {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sm-chev {
    transition: none;
  }
}
</style>
