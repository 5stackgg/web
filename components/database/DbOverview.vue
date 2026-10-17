<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import StatTile from "~/components/admin/StatTile.vue";
import DbGrid from "./DbGrid.vue";
import DbBar from "./DbBar.vue";
import DbSev from "./DbSev.vue";
import DbSlowBand from "./DbSlowBand.vue";
import SchemaSelector from "./SchemaSelector.vue";
import {
  deadFraction,
  deadSeverity,
  formatBig,
  formatPct,
  formatSize,
  hitSeverity,
  lockWaitCount,
  type DbGridColumn,
} from "./dbHealth";

const props = defineProps<{ db: Record<string, any> }>();
const emit = defineEmits<{
  (e: "go", key: string): void;
  (e: "open-query", queryid: string): void;
  (e: "view-slow"): void;
  (e: "update:schemas", schemas: string[]): void;
}>();

const { t } = useI18n();

const sort = ref("total_size");
const dir = ref<"asc" | "desc">("desc");

const stats = computed(() => props.db.databaseStats);
const conn = computed(() => props.db.connectionStats);
const lockWaits = computed(() => lockWaitCount(props.db.locks));
const storage = computed(() => props.db.storage);
const maxSize = computed(() =>
  Math.max(1, ...props.db.tables.map((tb: any) => tb.total_size || 0)),
);
const bandReady = computed(
  () => props.db.loaded.queries && props.db.loaded.active,
);

const columns = computed<DbGridColumn[]>(() => [
  { key: "relname", label: t("pages.database.columns.table") },
  {
    key: "total_size",
    label: t("pages.database.explorer.total_size"),
    num: true,
  },
  { key: "n_live_tup", label: t("pages.database.explorer.live"), num: true },
  {
    key: "dead",
    label: t("pages.database.explorer.dead_pct"),
    num: true,
    tip: t("pages.database.explorer.dead_pct_tip"),
    value: (r) => deadFraction(r.n_live_tup, r.n_dead_tup),
  },
  {
    key: "cache_hit_ratio",
    label: t("pages.database.explorer.cache_hit"),
    num: true,
  },
  { key: "seq_scan", label: t("pages.database.explorer.seq_scans"), num: true },
  {
    key: "last_autovacuum",
    label: t("pages.database.explorer.last_autovacuum"),
    value: (r) => (r.last_autovacuum ? Date.parse(r.last_autovacuum) : null),
  },
]);
</script>

<template>
  <div class="grid gap-6">
    <div class="grid gap-0.5">
      <h2 class="text-[19px] font-semibold">
        {{ stats?.datname || $t("layouts.app_nav.system.database") }}
      </h2>
      <p class="text-xs text-muted-foreground">
        {{ $t("pages.database.explorer.overview_hint") }}
      </p>
    </div>

    <DbSlowBand
      v-if="bandReady"
      :queries="db.queries"
      :active="db.active"
      :active-fetched-at="db.activeFetchedAt"
      :threshold="db.threshold"
      @open-query="emit('open-query', $event)"
      @view-slow="emit('view-slow')"
      @go="emit('go', $event)"
    />

    <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
      <StatTile
        :label="$t('pages.database.explorer.cache_hit_ratio')"
        :tone="hitSeverity(stats?.cache_hit_ratio) || undefined"
      >
        <DbSev :sev="hitSeverity(stats?.cache_hit_ratio)">{{
          formatPct(stats?.cache_hit_ratio) ?? "—"
        }}</DbSev>
      </StatTile>
      <StatTile
        :label="$t('pages.database.tabs.connections')"
        :value="conn?.total ?? null"
        :tone="lockWaits ? 'bad' : undefined"
      >
        <template v-if="conn" #sub>
          {{
            $t("pages.database.explorer.active_waiting", {
              active: conn.active,
              waiting: lockWaits,
            })
          }}
        </template>
      </StatTile>
      <StatTile
        :label="$t('pages.database.explorer.size_on_disk')"
        :value="storage ? formatSize(storage.total_database_size) : null"
      >
        <template v-if="storage" #sub>
          {{
            $t("pages.database.explorer.in_indexes", {
              size: formatSize(storage.total_indexes_size),
            })
          }}
        </template>
      </StatTile>
      <StatTile
        :label="$t('pages.database.explorer.reclaimable')"
        :value="
          storage ? formatSize(storage.estimated_reclaimable_space) : null
        "
        :sub="$t('pages.database.storage.from_dead_tuples')"
      />
      <StatTile
        :label="$t('pages.database.locks.commits')"
        :value="stats ? formatBig(stats.xact_commit) : null"
      >
        <template v-if="stats" #sub>
          {{
            $t("pages.database.explorer.rollbacks_count", {
              count: formatBig(stats.xact_rollback),
            })
          }}
        </template>
      </StatTile>
      <StatTile
        :label="$t('pages.database.locks.deadlocks')"
        :tone="stats?.deadlocks ? 'warn' : undefined"
      >
        <DbSev :sev="stats?.deadlocks ? 'warn' : ''">{{
          stats ? stats.deadlocks.toLocaleString() : "—"
        }}</DbSev>
      </StatTile>
    </div>

    <ManageSection
      :label="$t('pages.database.explorer.every_table')"
      :hint="$t('pages.database.explorer.every_table_hint')"
    >
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
        v-else-if="db.tables.length === 0"
        :title="$t('pages.database.explorer.no_tables_title')"
        :description="$t('pages.database.explorer.no_tables_hint')"
      />
      <DbGrid
        v-else
        v-model:sort="sort"
        v-model:dir="dir"
        :rows="db.tables"
        :columns="columns"
        :row-key="(r) => r.key"
        :max-height="520"
        clickable
        @row-click="(r) => emit('go', `t:${r.key}`)"
      >
        <template #cell-relname="{ row }">
          <span class="font-mono text-[11.5px] text-muted-foreground/70"
            >{{ row.schemaname }}.</span
          ><span class="font-mono text-[11.5px]">{{ row.relname }}</span>
          <span
            v-if="row.hyper"
            class="ml-1.5 inline-flex h-[18px] items-center rounded bg-[hsl(240_4%_12%)] px-1.5 text-[10.5px] text-muted-foreground"
            >{{ $t("pages.database.explorer.hypertable_tag") }}</span
          >
        </template>
        <template #cell-total_size="{ row }">
          <DbBar
            :value="(row.total_size || 0) / maxSize"
            :label="formatSize(row.total_size) ?? ''"
          />
        </template>
        <template #cell-n_live_tup="{ row }">{{
          formatBig(row.n_live_tup)
        }}</template>
        <template #cell-dead="{ row }">
          <template v-if="(row.n_live_tup || 0) + (row.n_dead_tup || 0) > 0">
            <DbSev :sev="deadSeverity(row.n_live_tup, row.n_dead_tup)"
              >{{
                Math.round(deadFraction(row.n_live_tup, row.n_dead_tup) * 100)
              }}%</DbSev
            >
          </template>
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
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
        <template #cell-seq_scan="{ row }">{{
          row.seq_scan == null ? "—" : formatBig(row.seq_scan)
        }}</template>
        <template #cell-last_autovacuum="{ row }">
          <span
            v-if="row.last_autovacuum"
            :title="new Date(row.last_autovacuum).toLocaleString(dateLocale())"
            ><TimeAgo :date="row.last_autovacuum" hide-icon
          /></span>
          <span v-else class="text-muted-foreground/60">{{
            $t("common.never")
          }}</span>
        </template>
      </DbGrid>
    </ManageSection>
  </div>
</template>
