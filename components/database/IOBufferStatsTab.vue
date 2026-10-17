<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import DbGrid from "./DbGrid.vue";
import DbSev from "./DbSev.vue";
import SchemaSelector from "./SchemaSelector.vue";
import {
  formatBig,
  formatPct,
  hitSeverity,
  type DbGridColumn,
} from "./dbHealth";

const props = defineProps<{ db: Record<string, any> }>();
const emit = defineEmits<{ (e: "update:schemas", schemas: string[]): void }>();
const { t } = useI18n();

const view = ref("table");
const viewOptions = computed(() => [
  { key: "table", label: t("pages.database.explorer.table_io") },
  { key: "index", label: t("pages.database.explorer.index_io") },
]);

const sort = ref("cache_hit_ratio");
const dir = ref<"asc" | "desc">("asc");
watch(view, () => {
  sort.value = "cache_hit_ratio";
  dir.value = "asc";
});

const tableRows = computed(() =>
  props.db.tables.filter(
    (tb: any) => (tb.heap_blks_hit || 0) + (tb.heap_blks_read || 0) > 0,
  ),
);
const indexRows = computed(() =>
  props.db.indexes.filter((i: any) => i.idx_blks_hit != null),
);
const rows = computed(() =>
  view.value === "table" ? tableRows.value : indexRows.value,
);

const columns = computed<DbGridColumn[]>(() =>
  view.value === "table"
    ? [
        { key: "schemaname", label: t("pages.database.columns.schema") },
        { key: "relname", label: t("pages.database.columns.table") },
        {
          key: "heap_blks_hit",
          label: t("pages.database.explorer.heap_hits"),
          num: true,
        },
        {
          key: "heap_blks_read",
          label: t("pages.database.explorer.heap_reads"),
          num: true,
        },
        {
          key: "idx_blks_hit",
          label: t("pages.database.explorer.index_hits"),
          num: true,
        },
        {
          key: "idx_blks_read",
          label: t("pages.database.explorer.index_reads"),
          num: true,
        },
        {
          key: "cache_hit_ratio",
          label: t("pages.database.explorer.cache_hit_pct"),
          num: true,
        },
      ]
    : [
        { key: "schemaname", label: t("pages.database.columns.schema") },
        { key: "tablename", label: t("pages.database.columns.table") },
        { key: "indexname", label: t("pages.database.columns.index") },
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
      ],
);
const numKeys = [
  "heap_blks_hit",
  "heap_blks_read",
  "idx_blks_hit",
  "idx_blks_read",
];
const cellSlot = (key: string) => `cell-${key}`;
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <AnimatedFilters v-model="view" square :options="viewOptions" />
      <SchemaSelector
        class="ml-auto"
        :model-value="db.schemas"
        @update:model-value="emit('update:schemas', $event)"
      />
    </div>

    <SectionEmpty
      v-if="db.schemas.length === 0"
      :title="$t('pages.database.explorer.no_schemas_title')"
      :description="$t('pages.database.explorer.no_schemas_hint')"
    />
    <SectionEmpty
      v-else-if="!rows.length"
      :title="
        view === 'table'
          ? $t('pages.database.io.no_table_stats')
          : $t('pages.database.io.no_index_io_stats')
      "
      :description="$t('pages.database.explorer.no_reads_hint')"
    />
    <DbGrid
      v-else
      :key="view"
      v-model:sort="sort"
      v-model:dir="dir"
      :rows="rows"
      :columns="columns"
      :row-key="
        (r) => (view === 'table' ? r.key : `${r.schemaname}.${r.indexname}`)
      "
      :max-height="560"
    >
      <template #cell-schemaname="{ row }">
        <span class="font-mono text-[11.5px] text-muted-foreground/70">{{
          row.schemaname
        }}</span>
      </template>
      <template #cell-relname="{ row }">
        <span class="font-mono text-[11.5px]">{{ row.relname }}</span>
      </template>
      <template #cell-tablename="{ row }">
        <span class="font-mono text-[11.5px]">{{ row.tablename }}</span>
      </template>
      <template #cell-indexname="{ row }">
        <span class="font-mono text-[11.5px]">{{ row.indexname }}</span>
      </template>
      <template v-for="key in numKeys" #[cellSlot(key)]="{ row }">{{
        formatBig(row[key])
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
  </div>
</template>
