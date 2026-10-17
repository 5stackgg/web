<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, CircleX, Loader } from "lucide-vue-next";
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import StatTile from "~/components/admin/StatTile.vue";
import DbGrid from "./DbGrid.vue";
import DbSev from "./DbSev.vue";
import type { DbGridColumn } from "./dbHealth";

const props = defineProps<{ db: Record<string, any> }>();
const { t } = useI18n();

const ts = computed(() => props.db.timescale);
const installed = computed(() => (ts.value?.hypertables?.length || 0) > 0);
const failed = computed(
  () =>
    (ts.value?.jobs || []).filter((j: any) => j.last_run_status === "Failed")
      .length,
);

const hyperColumns = computed<DbGridColumn[]>(() => [
  {
    key: "hypertable_name",
    label: t("pages.database.explorer.hypertable_name"),
  },
  { key: "num_chunks", label: t("pages.database.timescale.chunks"), num: true },
  {
    key: "compression_enabled",
    label: t("pages.database.timescale.compression"),
    value: (r) => (r.compression_enabled ? 1 : 0),
  },
]);
const hyperSort = ref("num_chunks");
const hyperDir = ref<"asc" | "desc">("desc");

const jobColumns = computed<DbGridColumn[]>(() => [
  { key: "job_id", label: t("pages.database.explorer.job_id"), num: true },
  { key: "job_type", label: t("pages.database.explorer.job_type") },
  { key: "hypertable_name", label: t("pages.database.timescale.hypertable") },
  {
    key: "last_run_status",
    label: t("pages.database.explorer.last_run_status"),
  },
  {
    key: "next_start",
    label: t("pages.database.explorer.next_start"),
    value: (r) => (r.next_start ? Date.parse(r.next_start) : null),
  },
]);
const jobSort = ref("job_id");
const jobDir = ref<"asc" | "desc">("asc");
</script>

<template>
  <SectionEmpty
    v-if="!installed"
    :title="$t('pages.database.explorer.no_timescale_title')"
    :description="$t('pages.database.timescale.no_data_description')"
  />
  <div v-else class="grid gap-6">
    <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
      <StatTile
        :label="$t('pages.database.timescale.hypertables')"
        :value="ts.hypertables.length"
      />
      <StatTile
        :label="$t('pages.database.explorer.total_chunks')"
        :value="(ts.chunks_count || 0).toLocaleString()"
      />
      <StatTile
        :label="$t('pages.database.explorer.background_jobs')"
        :value="ts.jobs.length"
        :tone="failed ? 'bad' : undefined"
      >
        <template v-if="failed" #sub>
          <DbSev sev="bad">{{
            $t("pages.database.explorer.n_failed", { count: failed })
          }}</DbSev>
        </template>
      </StatTile>
    </div>

    <ManageSection :label="$t('pages.database.timescale.hypertables')">
      <DbGrid
        v-model:sort="hyperSort"
        v-model:dir="hyperDir"
        :rows="ts.hypertables"
        :columns="hyperColumns"
        :row-key="(r) => r.hypertable_name"
      >
        <template #cell-hypertable_name="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.hypertable_name }}</span>
        </template>
        <template #cell-compression_enabled="{ row }">
          <span
            class="inline-flex h-5 items-center rounded-[5px] border px-1.5 text-[11px] font-semibold"
            :class="
              row.compression_enabled
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-border bg-[hsl(240_4%_10%)] text-muted-foreground'
            "
            >{{
              row.compression_enabled
                ? $t("pages.database.explorer.on")
                : $t("pages.database.explorer.off")
            }}</span
          >
        </template>
      </DbGrid>
    </ManageSection>

    <ManageSection :label="$t('pages.database.explorer.background_jobs')">
      <SectionEmpty
        v-if="!ts.jobs.length"
        :title="$t('pages.database.explorer.no_jobs_title')"
        :description="$t('pages.database.explorer.no_jobs_hint')"
      />
      <DbGrid
        v-else
        v-model:sort="jobSort"
        v-model:dir="jobDir"
        :rows="ts.jobs"
        :columns="jobColumns"
        :row-key="(r) => String(r.job_id)"
      >
        <template #cell-job_id="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.job_id }}</span>
        </template>
        <template #cell-job_type="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.job_type }}</span>
        </template>
        <template #cell-hypertable_name="{ row }">
          <span v-if="row.hypertable_name" class="font-mono text-[11.5px]">{{
            row.hypertable_name
          }}</span>
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
        <template #cell-last_run_status="{ row }">
          <span
            v-if="row.last_run_status === 'Success'"
            class="inline-flex h-5 items-center gap-1 rounded-[5px] border border-success/30 bg-success/10 px-1.5 text-[11px] font-semibold text-success"
            ><Check class="h-3 w-3" />{{ row.last_run_status }}</span
          >
          <span
            v-else-if="row.last_run_status === 'Failed'"
            class="inline-flex h-5 items-center gap-1 rounded-[5px] border border-destructive/30 bg-destructive/15 px-1.5 text-[11px] font-semibold text-destructive"
            ><CircleX class="h-3 w-3" />{{ row.last_run_status }}</span
          >
          <span
            v-else-if="row.last_run_status"
            class="inline-flex h-5 items-center gap-1 rounded-[5px] border border-info/30 bg-info/10 px-1.5 text-[11px] font-semibold text-info"
            ><Loader class="h-3 w-3" />{{ row.last_run_status }}</span
          >
          <span
            v-else
            class="inline-flex h-5 items-center rounded-[5px] border border-border bg-[hsl(240_4%_10%)] px-1.5 text-[11px] font-semibold text-muted-foreground"
            >{{ $t("pages.database.timescale.not_run") }}</span
          >
        </template>
        <template #cell-next_start="{ row }">
          <span
            v-if="row.next_start"
            :title="new Date(row.next_start).toLocaleString(dateLocale())"
            ><TimeAgo :date="row.next_start" hide-icon
          /></span>
          <span v-else class="text-muted-foreground/60">{{
            $t("pages.database.timescale.not_scheduled")
          }}</span>
        </template>
      </DbGrid>
    </ManageSection>
  </div>
</template>
