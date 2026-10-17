<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import AdminSearch from "~/components/admin/AdminSearch.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import DbGrid from "./DbGrid.vue";
import DbBar from "./DbBar.vue";
import DbQueryCell from "./DbQueryCell.vue";
import DbSev from "./DbSev.vue";
import {
  formatMs,
  formatPct,
  hitSeverity,
  isOverThreshold,
  msSeverity,
  thresholdLabel,
  type DbGridColumn,
} from "./dbHealth";

const props = defineProps<{ db: Record<string, any> }>();
const emit = defineEmits<{ (e: "open-query", queryid: string): void }>();

const slowOnly = defineModel<boolean>("slowOnly", { default: false });
const sort = defineModel<string>("sort", { default: "mean_exec_time" });
const dir = ref<"asc" | "desc">("desc");

const { t } = useI18n();

const search = ref("");
const minCalls = ref(5);

const thr = computed(() => props.db.threshold);
const label = computed(() => thresholdLabel(thr.value));

const showKey = computed({
  get: () => (slowOnly.value ? "slow" : "all"),
  set: (value: string) => (slowOnly.value = value === "slow"),
});
const showOptions = computed(() => [
  { key: "all", label: t("pages.database.explorer.all_statements") },
  {
    key: "slow",
    label: t("pages.database.explorer.over_threshold", {
      threshold: label.value,
    }),
  },
]);

const totalTime = computed(
  () =>
    props.db.queries.reduce(
      (s: number, q: any) => s + (q.total_exec_time || 0),
      0,
    ) || 1,
);

const rows = computed(() => {
  const q = search.value.trim().toLowerCase();
  const min = Math.max(0, Number(minCalls.value) || 0);
  return props.db.queries.filter(
    (s: any) =>
      (!q || s.query.toLowerCase().includes(q)) &&
      s.calls >= min &&
      (!slowOnly.value || isOverThreshold(s, thr.value)),
  );
});

const columns = computed<DbGridColumn[]>(() => [
  {
    key: "query",
    label: t("pages.database.columns.query"),
    wrap: true,
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
    key: "total_exec_time",
    label: t("pages.database.explorer.share_of_time"),
    tip: t("pages.database.explorer.share_of_time_tip"),
    num: true,
  },
  {
    key: "cache_hit_ratio",
    label: t("pages.database.explorer.cache_hit"),
    num: true,
  },
  {
    key: "temp_blks_written",
    label: t("pages.database.explorer.temp_blocks"),
    tip: t("pages.database.explorer.temp_blocks_tip"),
    num: true,
  },
  {
    key: "details",
    label: t("database_extras.details"),
    sortable: false,
    srOnly: true,
  },
]);
</script>

<template>
  <div class="grid gap-4">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <AdminSearch
        v-model="search"
        :placeholder="$t('pages.database.explorer.filter_query_text')"
      />
      <label
        class="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground"
      >
        {{ $t("pages.database.explorer.min_calls") }}
        <input
          v-model.number="minCalls"
          type="number"
          min="0"
          class="h-8 w-[76px] rounded-md border border-border bg-[hsl(240_6%_6%)] px-2.5 text-[13px] tabular-nums text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </label>
      <AnimatedFilters v-model="showKey" square :options="showOptions" />
      <span
        v-if="db.queries.length"
        class="ml-auto text-xs tabular-nums text-muted-foreground"
        >{{
          $t("pages.database.explorer.n_of_m_statements", {
            n: rows.length,
            m: db.queries.length,
          })
        }}</span
      >
    </div>

    <SectionEmpty
      v-if="!db.queries.length"
      :title="$t('pages.database.query_performance.no_stats')"
      :description="$t('pages.database.explorer.no_stats_hint')"
    />
    <SectionEmpty
      v-else-if="!rows.length && slowOnly && !search.trim()"
      :title="$t('pages.database.explorer.no_slow_title')"
      :description="
        $t('pages.database.explorer.no_slow_hint', { threshold: label })
      "
    />
    <SectionEmpty
      v-else-if="!rows.length"
      :title="$t('pages.database.explorer.no_statements_match')"
      :description="
        $t('pages.database.explorer.no_statements_match_hint', {
          min: minCalls,
        })
      "
    />
    <DbGrid
      v-else
      v-model:sort="sort"
      v-model:dir="dir"
      :rows="rows"
      :columns="columns"
      :row-key="(r) => r.queryid"
      :row-class="(r) => (r.mean_exec_time > thr ? 'is-hot' : '')"
      :max-height="620"
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
      <template #cell-total_exec_time="{ row }">
        <DbBar
          :value="(row.total_exec_time || 0) / totalTime"
          :label="`${(((row.total_exec_time || 0) / totalTime) * 100).toFixed(1)}%`"
        />
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
      <template #cell-temp_blks_written="{ row }">
        <DbSev v-if="row.temp_blks_written" sev="bad">{{
          row.temp_blks_written.toLocaleString()
        }}</DbSev>
        <span v-else class="text-muted-foreground/60">0</span>
      </template>
      <template #cell-details="{ row }">
        <button
          type="button"
          class="h-7 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          @click="emit('open-query', row.queryid)"
        >
          {{ $t("database_extras.details") }}
        </button>
      </template>
    </DbGrid>
  </div>
</template>
