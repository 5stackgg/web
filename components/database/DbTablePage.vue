<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  Check,
  CircleAlert,
  Clock,
  Copy,
  Hourglass,
  Info,
  TriangleAlert,
} from "lucide-vue-next";
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import StatTile from "~/components/admin/StatTile.vue";
import DbGrid from "./DbGrid.vue";
import DbLabel from "./DbLabel.vue";
import DbQueryCell from "./DbQueryCell.vue";
import DbSev from "./DbSev.vue";
import { copyText } from "./dbCopy";
import {
  deadFraction,
  deadSeverity,
  formatBig,
  formatMs,
  formatPct,
  formatSize,
  hitSeverity,
  isOverThreshold,
  msSeverity,
  relationMatches,
  thresholdLabel,
  touchesTable,
  type DbGridColumn,
  type Sev,
} from "./dbHealth";

// One table, gathered: size, bloat, vacuum history, each index's use and
// cache hits, its locks, and the statements that touch it.
const props = defineProps<{
  table: any | null;
  db: Record<string, any>;
  tableSev?: Sev;
}>();
const emit = defineEmits<{
  (e: "go", key: string): void;
  (e: "open-query", queryid: string): void;
}>();

const { t } = useI18n();

const thr = computed(() => props.db.threshold);

const locks = computed(() => {
  const tb = props.table;
  if (!tb) return [];
  const names = new Set(tb.indexes.map((i: any) => i.indexname));
  return props.db.locks.filter(
    (l: any) =>
      relationMatches(l.relation, tb.schemaname, tb.relname) ||
      (l.relation && names.has(l.relation.replace(/^.*\./, ""))),
  );
});

const statements = computed(() => {
  const tb = props.table;
  if (!tb) return [];
  return props.db.queries
    .filter((q: any) => touchesTable(q.query, tb.relname))
    .sort(
      (a: any, b: any) =>
        Number(isOverThreshold(b, thr.value)) -
          Number(isOverThreshold(a, thr.value)) ||
        b.mean_exec_time - a.mean_exec_time,
    );
});

const dead = computed(() =>
  props.table
    ? deadSeverity(props.table.n_live_tup, props.table.n_dead_tup)
    : "",
);

const indexScanShare = computed(() => {
  const tb = props.table;
  if (!tb || tb.seq_scan == null) return null;
  const all = (tb.seq_scan || 0) + (tb.idx_scan || 0);
  return all ? (tb.idx_scan || 0) / all : null;
});

const ixSort = ref("idx_scan");
const ixDir = ref<"asc" | "desc">("asc");
const ixColumns = computed<DbGridColumn[]>(() => [
  { key: "indexname", label: t("pages.database.columns.index") },
  { key: "idx_scan", label: t("pages.database.explorer.scans"), num: true },
  {
    key: "idx_tup_read",
    label: t("pages.database.explorer.tuples_read"),
    num: true,
  },
  {
    key: "idx_tup_fetch",
    label: t("pages.database.explorer.fetched"),
    num: true,
  },
  { key: "index_size", label: t("pages.database.explorer.size"), num: true },
  {
    key: "ratio",
    label: t("pages.database.explorer.pct_of_table"),
    num: true,
    value: (r) => (r.table_size ? r.index_size / r.table_size : null),
  },
  {
    key: "idx_blks_hit",
    label: t("pages.database.explorer.blocks_hit"),
    num: true,
  },
  {
    key: "idx_blks_read",
    label: t("pages.database.explorer.blocks_read"),
    num: true,
  },
  {
    key: "cache_hit_ratio",
    label: t("pages.database.explorer.cache_hit_pct"),
    num: true,
  },
]);

const lockColumns = computed<DbGridColumn[]>(() => [
  { key: "pid", label: t("pages.database.columns.pid"), num: true },
  { key: "relation", label: t("pages.database.query_performance.relation") },
  { key: "mode", label: t("pages.database.query_performance.mode") },
  {
    key: "granted",
    label: t("pages.database.query_performance.granted"),
    value: (r) => (r.granted ? 1 : 0),
  },
  { key: "usename", label: t("pages.database.columns.user") },
  { key: "query", label: t("pages.database.columns.query"), wrap: true },
]);
const lockSort = ref("granted");
const lockDir = ref<"asc" | "desc">("asc");

const stmtColumns = computed<DbGridColumn[]>(() => [
  {
    key: "query",
    label: t("pages.database.columns.query"),
    wrap: true,
    sortable: false,
  },
  {
    key: "calls",
    label: t("pages.database.query_performance.calls"),
    num: true,
  },
  {
    key: "mean_exec_time",
    label: t("pages.database.explorer.avg_ms_col"),
    num: true,
  },
  {
    key: "max_exec_time",
    label: t("pages.database.explorer.max_ms_col"),
    num: true,
  },
  {
    key: "temp_blks_written",
    label: t("pages.database.explorer.temp_blocks"),
    tip: t("pages.database.explorer.temp_blocks_tip"),
    num: true,
  },
]);
const stmtSort = ref("");
const stmtDir = ref<"asc" | "desc">("desc");

function copyName() {
  if (!props.table) return;
  void copyText(
    props.table.key,
    t("pages.database.explorer.name_copied"),
    t("pages.database.copy_failed"),
  );
}

const maintenance = computed(() => {
  const tb = props.table;
  if (!tb) return [];
  return [
    { label: t("pages.database.explorer.last_vacuum"), at: tb.last_vacuum },
    {
      label: t("pages.database.explorer.last_autovacuum"),
      at: tb.last_autovacuum,
    },
    { label: t("pages.database.explorer.last_analyze"), at: tb.last_analyze },
    {
      label: t("pages.database.explorer.last_autoanalyze"),
      at: tb.last_autoanalyze,
    },
  ] as Array<{ label: string; at: string | null }>;
});
</script>

<template>
  <SectionEmpty
    v-if="!table"
    :title="$t('pages.database.explorer.table_not_found')"
    :description="$t('pages.database.explorer.table_not_found_hint')"
  >
    <button
      type="button"
      class="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-muted"
      @click="emit('go', 'overview')"
    >
      {{ $t("pages.database.explorer.back_to_overview") }}
    </button>
  </SectionEmpty>

  <div v-else class="grid gap-6">
    <div class="flex flex-wrap items-start gap-3">
      <div class="min-w-0 flex-1">
        <h2 class="break-all font-mono text-[19px] font-semibold">
          <span class="text-muted-foreground/70">{{ table.schemaname }}.</span
          >{{ table.relname }}
        </h2>
        <div class="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            v-if="table.hyper"
            class="inline-flex h-5 items-center gap-1 rounded-[5px] border border-info/30 bg-info/10 px-1.5 text-[11px] font-semibold text-info"
          >
            <Clock class="h-3 w-3" />
            {{ $t("pages.database.timescale.hypertable") }}
          </span>
          <span
            v-if="tableSev"
            class="inline-flex h-5 items-center gap-1 rounded-[5px] border px-1.5 text-[11px] font-semibold"
            :class="
              tableSev === 'bad'
                ? 'border-destructive/30 bg-destructive/15 text-destructive'
                : 'border-warning/30 bg-warning/15 text-warning'
            "
          >
            <CircleAlert v-if="tableSev === 'bad'" class="h-3 w-3" />
            <TriangleAlert v-else class="h-3 w-3" />
            {{
              tableSev === "bad"
                ? $t("pages.database.explorer.needs_attention")
                : $t("pages.database.explorer.worth_a_look")
            }}
          </span>
          <span class="text-xs text-muted-foreground">{{
            $t("pages.database.explorer.on_disk", {
              size: formatSize(table.total_size),
            })
          }}</span>
        </div>
      </div>
      <button
        type="button"
        class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-muted"
        @click="copyName"
      >
        <Copy class="h-3 w-3" />
        {{ $t("pages.database.explorer.copy_name") }}
      </button>
    </div>

    <div
      v-if="table.hyper"
      class="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info/[0.08] px-3 py-2.5 text-[12.5px] text-sky-200"
    >
      <Info class="mt-px h-4 w-4 shrink-0 text-info" />
      <i18n-t keypath="pages.database.explorer.hypertable_note" tag="span">
        <template #schema
          ><span class="font-mono">_timescaledb_internal</span></template
        >
      </i18n-t>
    </div>

    <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
      <StatTile
        :label="$t('pages.database.explorer.total_size')"
        :value="formatSize(table.total_size)"
      >
        <template #sub>{{
          $t("pages.database.explorer.table_and_indexes", {
            table: formatSize(table.table_size),
            indexes: formatSize(table.indexes_size),
          })
        }}</template>
      </StatTile>
      <StatTile
        :label="$t('pages.database.explorer.live_tuples')"
        :value="(table.n_live_tup || 0).toLocaleString()"
      />
      <StatTile
        :label="$t('pages.database.explorer.dead_tuples')"
        :tone="dead || undefined"
      >
        <DbSev :sev="dead">{{
          (table.n_dead_tup || 0).toLocaleString()
        }}</DbSev>
        <template
          v-if="(table.n_live_tup || 0) + (table.n_dead_tup || 0) > 0"
          #sub
        >
          {{
            $t("pages.database.explorer.dead_share", {
              pct: Math.round(
                deadFraction(table.n_live_tup, table.n_dead_tup) * 100,
              ),
              size: formatSize(table.estimated_dead_tuple_bytes),
            })
          }}
        </template>
      </StatTile>
      <StatTile
        :label="$t('pages.database.explorer.cache_hit')"
        :tone="hitSeverity(table.cache_hit_ratio) || undefined"
      >
        <DbSev :sev="hitSeverity(table.cache_hit_ratio)">{{
          formatPct(table.cache_hit_ratio) ?? $t("common.na")
        }}</DbSev>
        <template v-if="table.heap_blks_read != null" #sub>{{
          $t("pages.database.explorer.heap_reads_count", {
            count: formatBig(table.heap_blks_read),
          })
        }}</template>
      </StatTile>
      <StatTile
        :label="$t('pages.database.explorer.index_scans')"
        :tip="$t('pages.database.explorer.index_scans_tip')"
        :value="
          indexScanShare == null ? null : `${Math.round(indexScanShare * 100)}%`
        "
      >
        <template v-if="table.seq_scan != null" #sub>{{
          $t("pages.database.explorer.sequential_count", {
            count: formatBig(table.seq_scan),
          })
        }}</template>
      </StatTile>
    </div>

    <div
      class="grid gap-x-7 gap-y-6 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]"
    >
      <section class="grid content-start gap-1.5">
        <DbLabel :label="$t('pages.database.explorer.maintenance')" />
        <dl class="db-dl">
          <div v-for="item in maintenance" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>
              <span
                v-if="item.at"
                :title="new Date(item.at).toLocaleString(dateLocale())"
                ><TimeAgo :date="item.at" hide-icon
              /></span>
              <span v-else class="text-muted-foreground/60">{{
                $t("common.never")
              }}</span>
            </dd>
          </div>
        </dl>
      </section>
      <section class="grid content-start gap-1.5">
        <DbLabel :label="$t('pages.database.explorer.activity')" />
        <dl class="db-dl">
          <div>
            <dt>{{ $t("pages.database.explorer.inserts") }}</dt>
            <dd>{{ formatBig(table.n_tup_ins) }}</dd>
          </div>
          <div>
            <dt>{{ $t("pages.database.explorer.updates") }}</dt>
            <dd>
              {{ formatBig(table.n_tup_upd) }}
              <small class="text-muted-foreground/70"
                >({{
                  $t("pages.database.explorer.hot_count", {
                    count: formatBig(table.n_tup_hot_upd),
                  })
                }})</small
              >
            </dd>
          </div>
          <div>
            <dt>{{ $t("pages.database.explorer.deletes") }}</dt>
            <dd>{{ formatBig(table.n_tup_del) }}</dd>
          </div>
          <div>
            <dt>{{ $t("pages.database.explorer.seq_scans_read") }}</dt>
            <dd>
              {{ formatBig(table.seq_scan) }}
              <small class="text-muted-foreground/70"
                >({{ formatBig(table.seq_tup_read) }})</small
              >
            </dd>
          </div>
          <div>
            <dt>{{ $t("pages.database.explorer.idx_scans_fetched") }}</dt>
            <dd>
              {{ formatBig(table.idx_scan) }}
              <small class="text-muted-foreground/70"
                >({{ formatBig(table.idx_tup_fetch) }})</small
              >
            </dd>
          </div>
        </dl>
      </section>
      <section class="grid content-start gap-1.5">
        <DbLabel :label="$t('pages.database.explorer.io')" />
        <dl class="db-dl">
          <div>
            <dt>{{ $t("pages.database.explorer.heap_hits") }}</dt>
            <dd>{{ formatBig(table.heap_blks_hit) }}</dd>
          </div>
          <div>
            <dt>{{ $t("pages.database.explorer.heap_reads") }}</dt>
            <dd>{{ formatBig(table.heap_blks_read) }}</dd>
          </div>
          <div>
            <dt>{{ $t("pages.database.explorer.index_hits") }}</dt>
            <dd>{{ formatBig(table.idx_blks_hit) }}</dd>
          </div>
          <div>
            <dt>{{ $t("pages.database.explorer.index_reads") }}</dt>
            <dd>{{ formatBig(table.idx_blks_read) }}</dd>
          </div>
          <div>
            <dt>{{ $t("pages.database.explorer.cache_hit_pct") }}</dt>
            <dd>
              <DbSev :sev="hitSeverity(table.cache_hit_ratio)">{{
                formatPct(table.cache_hit_ratio) ?? $t("common.na")
              }}</DbSev>
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <ManageSection
      :label="$t('pages.database.explorer.indexes')"
      :hint="$t('pages.database.explorer.indexes_hint')"
    >
      <SectionEmpty
        v-if="table.indexes.length === 0"
        :title="$t('pages.database.explorer.no_indexes')"
        :description="
          table.hyper
            ? $t('pages.database.explorer.no_indexes_hyper')
            : $t('pages.database.explorer.no_indexes_hint')
        "
      />
      <DbGrid
        v-else
        v-model:sort="ixSort"
        v-model:dir="ixDir"
        :rows="table.indexes"
        :columns="ixColumns"
        :row-key="(r) => `${r.schemaname}.${r.indexname}`"
      >
        <template #cell-indexname="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.indexname }}</span>
        </template>
        <template #cell-idx_scan="{ row }">
          <DbSev v-if="row.idx_scan === 0" sev="bad">{{
            $t("pages.database.explorer.zero_unused")
          }}</DbSev>
          <template v-else>{{ (row.idx_scan || 0).toLocaleString() }}</template>
        </template>
        <template #cell-idx_tup_read="{ row }">{{
          formatBig(row.idx_tup_read)
        }}</template>
        <template #cell-idx_tup_fetch="{ row }">{{
          formatBig(row.idx_tup_fetch)
        }}</template>
        <template #cell-index_size="{ row }">{{
          formatSize(row.index_size)
        }}</template>
        <template #cell-ratio="{ row }">{{
          row.table_size
            ? `${((row.index_size / row.table_size) * 100).toFixed(0)}%`
            : "—"
        }}</template>
        <template #cell-idx_blks_hit="{ row }">{{
          row.idx_blks_hit == null ? "—" : formatBig(row.idx_blks_hit)
        }}</template>
        <template #cell-idx_blks_read="{ row }">{{
          row.idx_blks_read == null ? "—" : formatBig(row.idx_blks_read)
        }}</template>
        <template #cell-cache_hit_ratio="{ row }">
          <DbSev
            v-if="row.cache_hit_ratio != null"
            :sev="hitSeverity(row.cache_hit_ratio)"
            >{{ formatPct(row.cache_hit_ratio) }}</DbSev
          >
          <span v-else class="text-muted-foreground/60">{{
            $t("common.na")
          }}</span>
        </template>
      </DbGrid>
    </ManageSection>

    <ManageSection :label="$t('pages.database.explorer.locks_on_table')">
      <p v-if="locks.length === 0" class="text-xs text-muted-foreground">
        {{ $t("pages.database.explorer.no_locks_on_table") }}
      </p>
      <DbGrid
        v-else
        v-model:sort="lockSort"
        v-model:dir="lockDir"
        :rows="locks"
        :columns="lockColumns"
        :row-key="(r) => `${r.pid}-${r.relation}-${r.mode}-${r.granted}`"
        :row-class="(r) => (r.granted ? '' : 'is-wait')"
      >
        <template #cell-pid="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.pid }}</span>
        </template>
        <template #cell-relation="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.relation }}</span>
        </template>
        <template #cell-mode="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.mode }}</span>
        </template>
        <template #cell-granted="{ row }">
          <span
            v-if="row.granted"
            class="inline-flex h-5 items-center gap-1 rounded-[5px] border border-success/30 bg-success/10 px-1.5 text-[11px] font-semibold text-success"
            ><Check class="h-3 w-3" />{{
              $t("pages.database.query_performance.granted")
            }}</span
          >
          <span
            v-else
            class="inline-flex h-5 items-center gap-1 rounded-[5px] border border-destructive/30 bg-destructive/15 px-1.5 text-[11px] font-semibold text-destructive"
            ><Hourglass class="h-3 w-3" />{{
              $t("pages.database.connections.waiting")
            }}</span
          >
        </template>
        <template #cell-usename="{ row }">{{ row.usename || "—" }}</template>
        <template #cell-query="{ row }">
          <DbQueryCell :query="row.query" />
        </template>
      </DbGrid>
    </ManageSection>

    <ManageSection
      :label="$t('pages.database.explorer.statements_touching')"
      :hint="
        $t('pages.database.explorer.statements_touching_hint', {
          threshold: thresholdLabel(thr),
        })
      "
    >
      <p v-if="statements.length === 0" class="text-xs text-muted-foreground">
        {{
          db.queries.length
            ? $t("pages.database.explorer.no_statements_for_table")
            : $t("pages.database.explorer.no_statements_yet")
        }}
      </p>
      <DbGrid
        v-else
        v-model:sort="stmtSort"
        v-model:dir="stmtDir"
        :rows="statements"
        :columns="stmtColumns"
        :row-key="(r) => r.queryid"
        :row-class="(r) => (isOverThreshold(r, thr) ? 'is-hot' : '')"
        clickable
        @row-click="(r) => emit('open-query', r.queryid)"
      >
        <template #cell-query="{ row }">
          <DbQueryCell :query="row.query" />
        </template>
        <template #cell-calls="{ row }">{{
          (row.calls || 0).toLocaleString()
        }}</template>
        <template #cell-mean_exec_time="{ row }">
          <DbSev :sev="msSeverity(row.mean_exec_time, thr)">{{
            formatMs(row.mean_exec_time)
          }}</DbSev>
        </template>
        <template #cell-max_exec_time="{ row }">
          <DbSev :sev="row.max_exec_time > thr ? 'warn' : ''">{{
            formatMs(row.max_exec_time)
          }}</DbSev>
        </template>
        <template #cell-temp_blks_written="{ row }">
          <DbSev v-if="row.temp_blks_written" sev="bad">{{
            row.temp_blks_written.toLocaleString()
          }}</DbSev>
          <span v-else class="text-muted-foreground/60">0</span>
        </template>
      </DbGrid>
    </ManageSection>
  </div>
</template>

<style scoped>
.db-dl {
  display: grid;
  margin: 0;
}
.db-dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid hsl(var(--border) / 0.6);
  font-size: 12.5px;
}
.db-dl dt {
  color: hsl(var(--muted-foreground));
}
.db-dl dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
