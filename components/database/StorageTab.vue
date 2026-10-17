<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ManageSection from "~/components/common/ManageSection.vue";
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
import DbTerm from "./DbTerm.vue";
import DbTile from "./DbTile.vue";
import SchemaSelector from "./SchemaSelector.vue";
import { deadSeverity, formatSize, type DbGridColumn } from "./dbHealth";

const props = defineProps<{ db: Record<string, any> }>();
const emit = defineEmits<{
  (e: "go", key: string): void;
  (e: "update:schemas", schemas: string[]): void;
}>();
const { t } = useI18n();

const ALL = "__all__";
const table = ref(ALL);
const summary = computed(() => props.db.storage);

const sized = computed(() =>
  props.db.tables.filter((tb: any) => tb.total_size != null),
);
const tables = computed(() =>
  [...new Set(sized.value.map((tb: any) => tb.relname as string))].sort(),
);
const rows = computed(() =>
  sized.value.filter(
    (tb: any) => table.value === ALL || tb.relname === table.value,
  ),
);
const maxSize = computed(() =>
  Math.max(1, ...sized.value.map((tb: any) => tb.total_size || 0)),
);

const sort = ref("total_size");
const dir = ref<"asc" | "desc">("desc");
const columns = computed<DbGridColumn[]>(() => [
  { key: "schemaname", label: t("pages.database.columns.schema") },
  { key: "relname", label: t("pages.database.columns.table") },
  {
    key: "total_size",
    label: t("pages.database.explorer.total_size"),
    num: true,
  },
  {
    key: "table_size",
    label: t("pages.database.explorer.table_size"),
    num: true,
  },
  {
    key: "indexes_size",
    label: t("pages.database.storage.indexes_size"),
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
    key: "estimated_dead_tuple_bytes",
    label: t("pages.database.explorer.dead_tuple_size"),
    num: true,
  },
]);
</script>

<template>
  <div class="grid gap-6">
    <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
      <DbTile :label="$t('pages.database.explorer.total_size')">
        {{ summary ? formatSize(summary.total_database_size) : "—" }}
      </DbTile>
      <DbTile :label="$t('pages.database.explorer.table_size')">
        {{ summary ? formatSize(summary.total_table_size) : "—" }}
      </DbTile>
      <DbTile :label="$t('pages.database.explorer.index_size')">
        {{ summary ? formatSize(summary.total_indexes_size) : "—" }}
      </DbTile>
      <DbTile>
        <template #label>
          <DbTerm :tip="$t('pages.database.explorer.reclaimable_tip')">{{
            $t("pages.database.explorer.reclaimable")
          }}</DbTerm>
        </template>
        {{ summary ? formatSize(summary.estimated_reclaimable_space) : "—" }}
        <template #sub>{{
          $t("pages.database.storage.from_dead_tuples")
        }}</template>
      </DbTile>
    </div>

    <ManageSection :label="$t('pages.database.explorer.table_storage')">
      <template #action>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <Select v-model="table">
            <SelectTrigger
              class="h-8 w-auto min-w-[150px] max-w-[220px] rounded-md bg-muted/30 px-2.5 text-xs"
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
          <SchemaSelector
            :model-value="db.schemas"
            @update:model-value="emit('update:schemas', $event)"
          />
        </div>
      </template>
      <SectionEmpty
        v-if="db.schemas.length === 0"
        :title="$t('pages.database.explorer.no_schemas_title')"
        :description="$t('pages.database.explorer.no_schemas_hint')"
      />
      <SectionEmpty
        v-else-if="!rows.length"
        :title="$t('pages.database.storage.no_tables')"
        :description="$t('pages.database.explorer.no_tables_hint')"
      />
      <DbGrid
        v-else
        v-model:sort="sort"
        v-model:dir="dir"
        :rows="rows"
        :columns="columns"
        :row-key="(r) => r.key"
        :max-height="560"
        clickable
        @row-click="(r) => emit('go', `t:${r.key}`)"
      >
        <template #cell-schemaname="{ row }">
          <span class="font-mono text-[11.5px] text-muted-foreground/70">{{
            row.schemaname
          }}</span>
        </template>
        <template #cell-relname="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.relname }}</span>
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
        <template #cell-table_size="{ row }">{{
          formatSize(row.table_size)
        }}</template>
        <template #cell-indexes_size="{ row }">{{
          formatSize(row.indexes_size)
        }}</template>
        <template #cell-n_live_tup="{ row }">{{
          (row.n_live_tup || 0).toLocaleString()
        }}</template>
        <template #cell-n_dead_tup="{ row }">
          <DbSev :sev="deadSeverity(row.n_live_tup, row.n_dead_tup)">{{
            (row.n_dead_tup || 0).toLocaleString()
          }}</DbSev>
        </template>
        <template #cell-estimated_dead_tuple_bytes="{ row }">{{
          formatSize(row.estimated_dead_tuple_bytes)
        }}</template>
      </DbGrid>
    </ManageSection>
  </div>
</template>
