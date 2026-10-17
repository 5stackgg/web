<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Archive,
  ChevronDown,
  CircleAlert,
  Clock,
  Database,
  Gauge,
  HardDrive,
  ListTree,
  Lock,
  Plug,
  TriangleAlert,
  Zap,
} from "lucide-vue-next";
import AdminSearch from "~/components/admin/AdminSearch.vue";
import { useListKeyboard } from "~/composables/useListKeyboard";
import SchemaSelector from "./SchemaSelector.vue";
import {
  SERVER_LABEL_KEYS,
  formatSize,
  runSeverity,
  slowStats,
  thresholdLabel,
  type Sev,
} from "./dbHealth";

const props = defineProps<{
  current: string;
  tables: any[];
  tableSev: Record<string, Sev>;
  schemas: string[];
  queries: any[];
  active: any[];
  locks: any[];
  connectionStats: any;
  timescale: any;
  threshold: number;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "go", key: string): void;
  (e: "update:schemas", schemas: string[]): void;
}>();

const { t } = useI18n();

const SERVER_ICONS: Record<string, any> = {
  overview: Gauge,
  queries: Zap,
  connections: Plug,
  locks: Lock,
  io: HardDrive,
  "index-usage": ListTree,
  storage: Database,
  timescale: Clock,
  backups: Archive,
};

const find = ref("");
// Chunks pile up by the hundred; their schema starts shut.
const collapsed = ref(new Set<string>(["_timescaledb_internal"]));

const slow = computed(() =>
  slowStats(props.queries, props.active, props.threshold),
);

type Badge = { n: number; tone: "warn" | "bad" | "plain" } | null;

const badges = computed<Record<string, Badge>>(() => {
  const s = slow.value;
  const waiting = props.locks.filter((l) => !l.granted).length;
  const failedJobs = (props.timescale?.jobs || []).filter(
    (j: any) => j.last_run_status === "Failed",
  ).length;
  return {
    queries: s.avg.length
      ? {
          n: s.avg.length,
          tone: s.avg.some((q) => q.mean_exec_time > props.threshold * 10)
            ? "bad"
            : "warn",
        }
      : null,
    connections: s.run.length
      ? {
          n: s.run.length,
          tone: s.run.some(
            (c) => runSeverity(c.duration_seconds, props.threshold) === "bad",
          )
            ? "bad"
            : "warn",
        }
      : props.connectionStats
        ? { n: props.connectionStats.total, tone: "plain" }
        : null,
    locks: waiting ? { n: waiting, tone: "bad" } : null,
    timescale: failedJobs ? { n: failedJobs, tone: "bad" } : null,
  };
});

const serverItems = computed(() =>
  Object.keys(SERVER_ICONS).map((key) => ({
    key,
    label: t(SERVER_LABEL_KEYS[key]),
    icon: SERVER_ICONS[key],
    badge: badges.value[key] || null,
  })),
);

const maxSize = computed(() =>
  Math.max(1, ...props.tables.map((tb) => tb.total_size || 0)),
);

const groups = computed(() => {
  const q = find.value.trim().toLowerCase();
  const match = (tb: any) =>
    !q ||
    tb.relname.toLowerCase().includes(q) ||
    tb.indexes.some((i: any) => i.indexname.toLowerCase().includes(q));
  return [...props.schemas]
    .sort((a, b) =>
      a === "public" ? -1 : b === "public" ? 1 : a.localeCompare(b),
    )
    .map((schema) => {
      const rows = props.tables
        .filter((tb) => tb.schemaname === schema && match(tb))
        .sort((a, b) => (b.total_size || 0) - (a.total_size || 0));
      return {
        schema,
        rows,
        open: !!q || !collapsed.value.has(schema),
      };
    })
    .filter((g) => g.rows.length > 0);
});

function toggleSchema(schema: string) {
  const next = new Set(collapsed.value);
  next.has(schema) ? next.delete(schema) : next.add(schema);
  collapsed.value = next;
}

// ↑/↓ walk every item the tree shows, Enter opens it.
const nav = ref<HTMLElement | null>(null);
const activeId = ref<string | null>(null);
const itemIds = computed(() => [
  ...(find.value.trim() ? [] : serverItems.value.map((item) => item.key)),
  ...groups.value.flatMap((group) =>
    group.open ? group.rows.map((tb: any) => `t:${tb.key}`) : [],
  ),
]);
const { rowProps } = useListKeyboard({
  items: itemIds,
  getId: (id) => id,
  activeId,
  container: nav,
  onOpen: (id) => emit("go", id),
});

// Tab lands on the open item; aria-current already marks it.
function itemProps(id: string) {
  const { "aria-selected": _selected, ...rest } = rowProps(id);
  if (!activeId.value && itemIds.value.includes(props.current)) {
    rest.tabindex = id === props.current ? 0 : -1;
  }
  return rest;
}

// Leaving the tree hands the arrow keys back to the page.
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  if (!next || !nav.value?.contains(next)) {
    activeId.value = null;
  }
}

watch(itemIds, (ids) => {
  if (activeId.value && !ids.includes(activeId.value)) {
    activeId.value = null;
  }
});

const badgeTitle = computed(() =>
  t("pages.database.explorer.over_threshold", {
    threshold: thresholdLabel(props.threshold),
  }),
);
</script>

<template>
  <nav
    ref="nav"
    class="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r lg:border-border/70"
    :aria-label="$t('pages.database.explorer.objects')"
    @focusout="onFocusOut"
  >
    <div class="grid gap-2 border-b border-border/60 pb-2.5 lg:pr-3">
      <AdminSearch
        v-model="find"
        shortcut
        :placeholder="$t('pages.database.explorer.find_table')"
      />
      <SchemaSelector
        :model-value="schemas"
        class="w-full max-w-none justify-between"
        @update:model-value="emit('update:schemas', $event)"
      />
    </div>

    <div
      class="db-tree-body overflow-y-auto py-1.5 lg:max-h-[calc(100vh-11rem)] lg:pr-2"
      :class="!open && 'max-lg:hidden'"
    >
      <template v-if="!find.trim()">
        <div class="px-2 pb-1 pt-2.5 text-[11px] text-muted-foreground/70">
          {{ $t("pages.database.explorer.server") }}
        </div>
        <button
          v-for="item in serverItems"
          :key="item.key"
          type="button"
          class="db-tree-item"
          v-bind="itemProps(item.key)"
          :aria-current="current === item.key ? 'true' : undefined"
          @click="emit('go', item.key)"
        >
          <span class="grid w-4 place-items-center">
            <component :is="item.icon" class="h-3.5 w-3.5" />
          </span>
          <span class="truncate">{{ item.label }}</span>
          <span class="text-[11px] tabular-nums text-muted-foreground/70">
            <span
              v-if="item.badge && item.badge.tone !== 'plain'"
              class="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10.5px] font-bold"
              :class="
                item.badge.tone === 'bad'
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-warning/15 text-warning'
              "
              :title="
                item.key === 'queries' || item.key === 'connections'
                  ? badgeTitle
                  : undefined
              "
              >{{ item.badge.n }}</span
            >
            <template v-else-if="item.badge">{{ item.badge.n }}</template>
          </span>
        </button>
      </template>

      <template v-for="group in groups" :key="group.schema">
        <div
          class="flex items-center gap-1.5 px-2 pb-1 pt-2.5 text-[11px] text-muted-foreground/70"
        >
          <button
            type="button"
            class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            :aria-expanded="group.open"
            @click="toggleSchema(group.schema)"
          >
            <ChevronDown
              class="db-tree-chev h-3 w-3"
              :class="!group.open && '-rotate-90'"
            />
            <span class="font-mono">{{ group.schema }}</span>
          </button>
          <span class="ml-auto tabular-nums">{{ group.rows.length }}</span>
        </div>
        <template v-if="group.open">
          <button
            v-for="tb in group.rows"
            :key="tb.key"
            type="button"
            class="db-tree-item is-table"
            v-bind="itemProps(`t:${tb.key}`)"
            :aria-current="current === `t:${tb.key}` ? 'true' : undefined"
            :title="tb.key"
            @click="emit('go', `t:${tb.key}`)"
          >
            <span class="grid w-4 place-items-center">
              <CircleAlert
                v-if="tableSev[tb.key] === 'bad'"
                class="h-3 w-3 text-destructive"
              />
              <TriangleAlert
                v-else-if="tableSev[tb.key] === 'warn'"
                class="h-3 w-3 text-warning"
              />
              <Clock
                v-else-if="tb.hyper"
                class="h-3 w-3 text-muted-foreground/60"
              />
            </span>
            <span class="truncate font-mono text-[11.5px]">{{
              tb.relname
            }}</span>
            <span class="text-[11px] tabular-nums text-muted-foreground/70">{{
              formatSize(tb.total_size)
            }}</span>
            <span class="db-tree-size" aria-hidden="true">
              <i
                :style="{
                  transform: `scaleX(${((tb.total_size || 0) / maxSize).toFixed(3)})`,
                }"
              />
            </span>
          </button>
        </template>
      </template>

      <p
        v-if="find.trim() && groups.length === 0"
        class="px-3 py-3 text-xs text-muted-foreground"
      >
        {{
          $t("pages.database.explorer.no_table_matches", { find: find.trim() })
        }}
      </p>
    </div>
  </nav>
</template>

<style scoped>
.db-tree-body {
  scrollbar-width: thin;
}
.db-tree-item {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border-radius: 6px;
  color: hsl(var(--muted-foreground));
  text-align: left;
  font-size: 13px;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}
.db-tree-item:hover {
  background: hsl(240 4% 9%);
  color: hsl(var(--foreground));
}
.db-tree-item:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1px hsl(var(--ring));
}
.db-tree-item[aria-current="true"] {
  background: hsl(240 4% 11%);
  color: hsl(var(--foreground));
}
.db-tree-item[aria-current="true"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: hsl(var(--tac-amber));
}
.db-tree-size {
  position: absolute;
  left: 32px;
  right: 8px;
  bottom: 3px;
  height: 2px;
  border-radius: 2px;
  background: hsl(240 4% 12%);
  overflow: hidden;
}
.db-tree-size i {
  position: absolute;
  inset: 0;
  background: hsl(var(--tac-amber) / 0.45);
  transform-origin: left;
  transition: transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
.db-tree-chev {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .db-tree-size i,
  .db-tree-chev {
    transition: none;
  }
}
</style>
