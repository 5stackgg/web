<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, Hourglass } from "lucide-vue-next";
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import DbGrid from "./DbGrid.vue";
import DbQueryCell from "./DbQueryCell.vue";
import DbSev from "./DbSev.vue";
import DbTerm from "./DbTerm.vue";
import DbTile from "./DbTile.vue";
import SchemaSelector from "./SchemaSelector.vue";
import {
  deadSeverity,
  formatBig,
  formatPct,
  hitSeverity,
  type DbGridColumn,
} from "./dbHealth";

const props = defineProps<{ db: Record<string, any> }>();
const emit = defineEmits<{ (e: "update:schemas", schemas: string[]): void }>();
const { t } = useI18n();

const stats = computed(() => props.db.databaseStats);
const waiting = computed(
  () => props.db.locks.filter((l: any) => !l.granted).length,
);

const facts = computed(() => {
  const d = stats.value;
  if (!d) return [];
  return [
    [t("pages.database.explorer.tuples_inserted"), formatBig(d.tup_inserted)],
    [t("pages.database.explorer.tuples_updated"), formatBig(d.tup_updated)],
    [t("pages.database.explorer.tuples_deleted"), formatBig(d.tup_deleted)],
    [t("pages.database.explorer.tuples_returned"), formatBig(d.tup_returned)],
    [t("pages.database.explorer.tuples_fetched"), formatBig(d.tup_fetched)],
    [t("pages.database.explorer.blocks_hit"), formatBig(d.blks_hit)],
    [t("pages.database.explorer.blocks_read"), formatBig(d.blks_read)],
    [
      t("pages.database.explorer.conflicts"),
      (d.conflicts || 0).toLocaleString(),
    ],
  ];
});

const lockColumns = computed<DbGridColumn[]>(() => [
  { key: "pid", label: t("pages.database.columns.pid"), num: true },
  { key: "locktype", label: t("pages.database.explorer.lock_type") },
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

const at = (key: string) => (r: any) => (r[key] ? Date.parse(r[key]) : null);
const maintColumns = computed<DbGridColumn[]>(() => [
  { key: "schemaname", label: t("pages.database.columns.schema") },
  { key: "relname", label: t("pages.database.columns.table") },
  { key: "seq_scan", label: t("pages.database.explorer.seq_scans"), num: true },
  {
    key: "seq_tup_read",
    label: t("pages.database.explorer.seq_tup_read"),
    num: true,
  },
  { key: "idx_scan", label: t("pages.database.explorer.idx_scans"), num: true },
  {
    key: "idx_tup_fetch",
    label: t("pages.database.explorer.idx_tup_fetch"),
    num: true,
  },
  { key: "n_tup_ins", label: t("pages.database.explorer.inserts"), num: true },
  { key: "n_tup_upd", label: t("pages.database.explorer.updates"), num: true },
  { key: "n_tup_del", label: t("pages.database.explorer.deletes"), num: true },
  {
    key: "n_tup_hot_upd",
    label: t("pages.database.explorer.hot_updates"),
    tip: t("pages.database.explorer.hot_updates_tip"),
    num: true,
  },
  {
    key: "n_live_tup",
    label: t("pages.database.explorer.live_tuples"),
    num: true,
  },
  {
    key: "n_dead_tup",
    label: t("pages.database.explorer.dead_tuples"),
    num: true,
  },
  {
    key: "last_vacuum",
    label: t("pages.database.explorer.last_vacuum"),
    value: at("last_vacuum"),
  },
  {
    key: "last_autovacuum",
    label: t("pages.database.explorer.last_autovacuum"),
    value: at("last_autovacuum"),
  },
  {
    key: "last_analyze",
    label: t("pages.database.explorer.last_analyze"),
    value: at("last_analyze"),
  },
  {
    key: "last_autoanalyze",
    label: t("pages.database.explorer.last_autoanalyze"),
    value: at("last_autoanalyze"),
  },
]);
const maintSort = ref("n_dead_tup");
const maintDir = ref<"asc" | "desc">("desc");
const maintRows = computed(() =>
  props.db.tables.filter((tb: any) => tb.seq_scan != null),
);
const cellSlot = (key: string) => `cell-${key}`;
const dateKeys = [
  "last_vacuum",
  "last_autovacuum",
  "last_analyze",
  "last_autoanalyze",
];
const countKeys = [
  "seq_scan",
  "seq_tup_read",
  "idx_scan",
  "idx_tup_fetch",
  "n_tup_ins",
  "n_tup_upd",
  "n_tup_del",
  "n_tup_hot_upd",
];
</script>

<template>
  <div class="grid gap-6">
    <ManageSection :label="$t('pages.database.explorer.database_statistics')">
      <template v-if="stats" #action>
        <span class="font-mono text-xs text-muted-foreground">{{
          stats.datname
        }}</span>
      </template>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
        <DbTile
          :label="$t('pages.database.explorer.cache_hit_ratio')"
          :sev="hitSeverity(stats?.cache_hit_ratio)"
        >
          <DbSev :sev="hitSeverity(stats?.cache_hit_ratio)">{{
            formatPct(stats?.cache_hit_ratio) ?? "—"
          }}</DbSev>
        </DbTile>
        <DbTile :label="$t('pages.database.explorer.active_backends')">
          {{ stats ? stats.numbackends.toLocaleString() : "—" }}
        </DbTile>
        <DbTile :label="$t('pages.database.locks.commits')">
          {{ stats ? formatBig(stats.xact_commit) : "—" }}
        </DbTile>
        <DbTile :label="$t('pages.database.locks.rollbacks')">
          {{ stats ? formatBig(stats.xact_rollback) : "—" }}
        </DbTile>
        <DbTile :sev="stats?.deadlocks ? 'warn' : ''">
          <template #label>
            <DbTerm :tip="$t('pages.database.explorer.deadlocks_tip')">{{
              $t("pages.database.locks.deadlocks")
            }}</DbTerm>
          </template>
          <DbSev :sev="stats?.deadlocks ? 'warn' : ''">{{
            stats ? stats.deadlocks.toLocaleString() : "—"
          }}</DbSev>
        </DbTile>
      </div>
      <dl
        v-if="facts.length"
        class="grid gap-x-6 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]"
      >
        <div
          v-for="[label, value] in facts"
          :key="label"
          class="flex justify-between gap-3 border-b border-border/60 py-[7px] text-[12.5px]"
        >
          <dt class="text-muted-foreground">{{ label }}</dt>
          <dd class="text-right tabular-nums">{{ value }}</dd>
        </div>
      </dl>
    </ManageSection>

    <ManageSection :label="$t('pages.database.explorer.current_locks')">
      <template #action>
        <span class="text-xs text-muted-foreground">
          <DbSev v-if="waiting" sev="bad">{{
            $t("pages.database.explorer.n_waiting", { count: waiting })
          }}</DbSev>
          <template v-else>{{
            $t(
              "pages.database.explorer.held_none_waiting",
              { count: db.locks.length },
              db.locks.length,
            )
          }}</template>
        </span>
      </template>
      <SectionEmpty
        v-if="!db.locks.length"
        :title="$t('pages.database.locks.no_locks')"
        :description="$t('pages.database.explorer.no_locks_hint')"
      />
      <DbGrid
        v-else
        v-model:sort="lockSort"
        v-model:dir="lockDir"
        :rows="db.locks"
        :columns="lockColumns"
        :row-key="
          (r) => `${r.pid}-${r.locktype}-${r.relation}-${r.mode}-${r.granted}`
        "
        :row-class="(r) => (r.granted ? '' : 'is-wait')"
        :max-height="380"
      >
        <template #cell-pid="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.pid }}</span>
        </template>
        <template #cell-relation="{ row }">
          <span v-if="row.relation" class="font-mono text-[11.5px]">{{
            row.relation
          }}</span>
          <span v-else class="text-muted-foreground/60">—</span>
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

    <ManageSection :label="$t('pages.database.explorer.table_maintenance')">
      <template #action>
        <SchemaSelector
          :model-value="db.schemas"
          @update:model-value="emit('update:schemas', $event)"
        />
      </template>
      <SectionEmpty
        v-if="db.schemas.length === 0"
        :title="$t('pages.database.explorer.no_schemas_title')"
        :description="$t('pages.database.explorer.no_schemas_hint')"
      />
      <SectionEmpty
        v-else-if="!maintRows.length"
        :title="$t('pages.database.locks.no_table_stats')"
        :description="$t('pages.database.explorer.no_tables_hint')"
      />
      <DbGrid
        v-else
        v-model:sort="maintSort"
        v-model:dir="maintDir"
        :rows="maintRows"
        :columns="maintColumns"
        :row-key="(r) => r.key"
        :max-height="480"
      >
        <template #cell-schemaname="{ row }">
          <span class="font-mono text-[11.5px] text-muted-foreground/70">{{
            row.schemaname
          }}</span>
        </template>
        <template #cell-relname="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.relname }}</span>
        </template>
        <template v-for="key in countKeys" #[cellSlot(key)]="{ row }">{{
          formatBig(row[key])
        }}</template>
        <template #cell-n_live_tup="{ row }">{{
          (row.n_live_tup || 0).toLocaleString()
        }}</template>
        <template #cell-n_dead_tup="{ row }">
          <DbSev :sev="deadSeverity(row.n_live_tup, row.n_dead_tup)">{{
            (row.n_dead_tup || 0).toLocaleString()
          }}</DbSev>
        </template>
        <template v-for="key in dateKeys" #[cellSlot(key)]="{ row }">
          <span
            v-if="row[key]"
            :title="new Date(row[key]).toLocaleString(dateLocale())"
            ><TimeAgo :date="row[key]" hide-icon
          /></span>
          <span v-else class="text-muted-foreground/60">{{
            $t("common.never")
          }}</span>
        </template>
      </DbGrid>
    </ManageSection>
  </div>
</template>
