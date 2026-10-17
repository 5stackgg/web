<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Search } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import DbBar from "./DbBar.vue";
import DbGrid from "./DbGrid.vue";
import DbSev from "./DbSev.vue";
import SchemaSelector from "./SchemaSelector.vue";
import { formatBig, formatSize, type DbGridColumn } from "./dbHealth";

const props = defineProps<{ db: Record<string, any> }>();
const emit = defineEmits<{
  (e: "go", key: string): void;
  (e: "update:schemas", schemas: string[]): void;
}>();
const { t } = useI18n();

// reka reserves "" for the placeholder, so "all tables" needs a real value.
const ALL = "__all__";
const table = ref(ALL);
const search = ref("");
const usage = ref("all");
const usageOptions = computed(() => [
  { key: "all", label: t("common.all") },
  { key: "unused", label: t("pages.database.explorer.never_scanned") },
]);

const sort = ref("idx_scan");
const dir = ref<"asc" | "desc">("asc");
watch(usage, (value) => {
  sort.value = value === "unused" ? "index_size" : "idx_scan";
  dir.value = value === "unused" ? "desc" : "asc";
});

const tables = computed(() =>
  [...new Set(props.db.indexes.map((i: any) => i.tablename as string))].sort(),
);

const rows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return props.db.indexes.filter(
    (i: any) =>
      (table.value === ALL || i.tablename === table.value) &&
      (!q || i.indexname.toLowerCase().includes(q)) &&
      (usage.value !== "unused" || i.idx_scan === 0),
  );
});

const columns = computed<DbGridColumn[]>(() => [
  { key: "schemaname", label: t("pages.database.columns.schema") },
  { key: "tablename", label: t("pages.database.columns.table") },
  { key: "indexname", label: t("pages.database.columns.index") },
  {
    key: "idx_scan",
    label: t("pages.database.explorer.index_scans"),
    num: true,
  },
  {
    key: "idx_tup_read",
    label: t("pages.database.explorer.tuples_read"),
    num: true,
  },
  {
    key: "idx_tup_fetch",
    label: t("pages.database.explorer.tuples_fetched"),
    num: true,
  },
  {
    key: "index_size",
    label: t("pages.database.explorer.index_size"),
    num: true,
  },
  {
    key: "table_size",
    label: t("pages.database.explorer.table_size"),
    num: true,
  },
  {
    key: "ratio",
    label: t("pages.database.explorer.pct_of_table"),
    num: true,
    value: (r) => (r.table_size ? r.index_size / r.table_size : null),
  },
]);
</script>

<template>
  <div class="grid gap-4">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <Select v-model="table">
        <SelectTrigger
          class="h-8 w-auto min-w-[160px] max-w-[240px] rounded-md bg-muted/30 px-2.5 text-xs"
          :aria-label="$t('pages.database.columns.table')"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL">{{
            $t("database_extras.all_tables")
          }}</SelectItem>
          <SelectItem v-for="name in tables" :key="name" :value="name">
            <span class="font-mono text-xs">{{ name }}</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <label class="relative block w-full sm:w-[260px]">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70"
        />
        <input
          v-model="search"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="h-8 w-full rounded-md border border-border bg-[hsl(240_6%_6%)] pl-8 pr-2.5 text-[13px] outline-none placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
          :placeholder="$t('pages.database.explorer.search_indexes')"
          :aria-label="$t('pages.database.explorer.search_indexes')"
        />
      </label>
      <AnimatedFilters v-model="usage" square :options="usageOptions" />
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
      v-else-if="!rows.length && usage === 'unused'"
      :title="$t('pages.database.explorer.all_indexes_scanned')"
      :description="$t('pages.database.explorer.all_indexes_scanned_hint')"
    />
    <SectionEmpty
      v-else-if="!rows.length"
      :title="$t('pages.database.index_usage.no_stats')"
      :description="$t('pages.database.explorer.nothing_matches')"
    />
    <DbGrid
      v-else
      v-model:sort="sort"
      v-model:dir="dir"
      :rows="rows"
      :columns="columns"
      :row-key="(r) => `${r.schemaname}.${r.indexname}`"
      :max-height="560"
      clickable
      @row-click="(r) => emit('go', `t:${r.schemaname}.${r.tablename}`)"
    >
      <template #cell-schemaname="{ row }">
        <span class="font-mono text-[11.5px] text-muted-foreground/70">{{
          row.schemaname
        }}</span>
      </template>
      <template #cell-tablename="{ row }">
        <span class="font-mono text-[11.5px]">{{ row.tablename }}</span>
      </template>
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
      <template #cell-table_size="{ row }">{{
        formatSize(row.table_size)
      }}</template>
      <template #cell-ratio="{ row }">
        <template v-if="row.table_size">
          <DbBar
            :value="row.index_size / row.table_size"
            :label="`${((row.index_size / row.table_size) * 100).toFixed(0)}%`"
          />
        </template>
        <span v-else class="text-muted-foreground/60">—</span>
      </template>
    </DbGrid>
  </div>
</template>
