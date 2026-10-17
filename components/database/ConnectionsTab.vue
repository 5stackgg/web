<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import StatTile from "~/components/admin/StatTile.vue";
import DbGrid from "./DbGrid.vue";
import DbPidMenu from "./DbPidMenu.vue";
import DbQueryCell from "./DbQueryCell.vue";
import DbRunning from "./DbRunning.vue";
import DbSev from "./DbSev.vue";
import DbStatePill from "./DbStatePill.vue";
import { lockWaitCount, type DbGridColumn } from "./dbHealth";

const props = defineProps<{ db: Record<string, any> }>();
const { t } = useI18n();

const stats = computed(() => props.db.connectionStats);
const lockWaits = computed(() => lockWaitCount(props.db.locks));
const longIdleTxn = computed(() =>
  props.db.active.some(
    (q: any) =>
      q.state === "idle in transaction" && (q.duration_seconds || 0) > 60,
  ),
);

const byStateColumns = computed<DbGridColumn[]>(() => [
  { key: "state", label: t("pages.database.columns.state") },
  { key: "count", label: t("pages.database.explorer.count"), num: true },
  {
    key: "wait_event_type",
    label: t("pages.database.explorer.wait_event_type"),
  },
]);
const byStateSort = ref("count");
const byStateDir = ref<"asc" | "desc">("desc");

const baseColumns = (): DbGridColumn[] => [
  { key: "pid", label: t("pages.database.columns.pid"), num: true },
  { key: "usename", label: t("pages.database.columns.user") },
  { key: "application_name", label: t("pages.database.columns.app") },
  { key: "client_addr", label: t("pages.database.columns.client") },
  { key: "state", label: t("pages.database.columns.state"), minWidth: 104 },
];

const activeColumns = computed<DbGridColumn[]>(() => [
  ...baseColumns(),
  { key: "wait_event", label: t("pages.database.explorer.wait_event") },
  {
    key: "duration_seconds",
    label: t("pages.database.columns.duration"),
    num: true,
  },
  { key: "query", label: t("pages.database.columns.query"), wrap: true },
  {
    key: "actions",
    label: t("common.actions_label"),
    sortable: false,
    srOnly: true,
  },
]);
const activeSort = ref("duration_seconds");
const activeDir = ref<"asc" | "desc">("desc");

const allColumns = computed<DbGridColumn[]>(() => [
  ...baseColumns(),
  { key: "query", label: t("pages.database.columns.query"), wrap: true },
  {
    key: "query_start",
    label: t("pages.database.explorer.started"),
    minWidth: 150,
    value: (r) => (r.query_start ? Date.parse(r.query_start) : null),
  },
  {
    key: "actions",
    label: t("common.actions_label"),
    sortable: false,
    srOnly: true,
  },
]);
// By pid, not by query start: pooled connections pick up a new query every
// few seconds, and a live list ordered by that reshuffles on every poll.
const allSort = ref("pid");
const allDir = ref<"asc" | "desc">("asc");
</script>

<template>
  <div class="grid gap-6">
    <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
      <StatTile
        :label="$t('pages.database.connections.total')"
        :value="stats?.total ?? null"
      />
      <StatTile
        :label="$t('pages.database.connections.active')"
        :value="stats?.active ?? null"
      />
      <StatTile
        :label="$t('pages.database.connections.idle')"
        :value="stats?.idle ?? null"
      />
      <StatTile
        :label="$t('pages.database.explorer.idle_in_txn')"
        :tip="$t('pages.database.explorer.idle_in_txn_tip')"
        :value="stats?.idle_in_transaction ?? null"
        :tone="stats?.idle_in_transaction && longIdleTxn ? 'warn' : undefined"
      />
      <StatTile
        :label="$t('pages.database.connections.waiting')"
        :tip="$t('pages.database.explorer.waiting_tip')"
        :tone="lockWaits ? 'bad' : undefined"
      >
        <DbSev :sev="lockWaits ? 'bad' : ''">{{
          lockWaits.toLocaleString()
        }}</DbSev>
      </StatTile>
    </div>

    <ManageSection :label="$t('pages.database.explorer.by_state')">
      <DbGrid
        v-if="stats?.by_state?.length"
        v-model:sort="byStateSort"
        v-model:dir="byStateDir"
        :rows="stats.by_state"
        :columns="byStateColumns"
        :row-key="(r) => `${r.state || 'none'}|${r.wait_event_type || ''}`"
        hold-height
      >
        <template #cell-state="{ row }">
          <DbStatePill :state="row.state" />
        </template>
        <template #cell-wait_event_type="{ row }">
          <DbSev
            v-if="row.wait_event_type"
            :sev="row.wait_event_type === 'Lock' ? 'bad' : ''"
            >{{ row.wait_event_type }}</DbSev
          >
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
      </DbGrid>
      <p v-else class="text-xs text-muted-foreground">
        {{ $t("pages.database.connections.no_connections") }}
      </p>
    </ManageSection>

    <ManageSection
      :label="$t('pages.database.explorer.active_queries')"
      :hint="$t('pages.database.explorer.active_queries_hint')"
    >
      <!-- Stays mounted through empty polls: short queries come and go every
           few seconds, and swapping in an empty state each time jolted the
           page. -->
      <DbGrid
        v-model:sort="activeSort"
        v-model:dir="activeDir"
        :rows="db.active"
        :columns="activeColumns"
        :row-key="(r) => String(r.pid)"
        :row-class="(r) => (r.wait_event_type === 'Lock' ? 'is-wait' : '')"
        :max-height="420"
        hold-height
      >
        <template #empty>{{
          $t("pages.database.connections.no_active_queries")
        }}</template>
        <template #cell-pid="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.pid }}</span>
        </template>
        <template #cell-application_name="{ row }">
          <span
            class="block max-w-[180px] truncate"
            :title="row.application_name || undefined"
            >{{ row.application_name || "—" }}</span
          >
        </template>
        <template #cell-client_addr="{ row }">
          <span v-if="row.client_addr" class="font-mono text-[11.5px]">{{
            row.client_addr
          }}</span>
          <span v-else class="text-muted-foreground/60">{{
            $t("pages.database.explorer.local")
          }}</span>
        </template>
        <template #cell-state="{ row }">
          <DbStatePill :state="row.state" />
        </template>
        <template #cell-wait_event="{ row }">
          <template v-if="row.wait_event_type">
            <DbSev :sev="row.wait_event_type === 'Lock' ? 'bad' : ''">{{
              row.wait_event_type
            }}</DbSev>
            <span v-if="row.wait_event" class="text-muted-foreground/70">
              · {{ row.wait_event }}</span
            >
          </template>
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
        <template #cell-duration_seconds="{ row }">
          <DbRunning
            :seconds="row.duration_seconds"
            :fetched-at="db.activeFetchedAt"
            :state="row.state"
            :threshold="db.threshold"
          />
        </template>
        <template #cell-query="{ row }">
          <DbQueryCell :query="row.query" />
        </template>
        <template #cell-actions="{ row }">
          <DbPidMenu :pid="row.pid" :query="row.query" />
        </template>
      </DbGrid>
    </ManageSection>

    <ManageSection :label="$t('pages.database.explorer.all_connections')">
      <SectionEmpty
        v-if="!db.connections.length"
        :title="$t('pages.database.connections.no_connections')"
        :description="$t('pages.database.explorer.no_connections_hint')"
      />
      <DbGrid
        v-else
        v-model:sort="allSort"
        v-model:dir="allDir"
        :rows="db.connections"
        :columns="allColumns"
        :row-key="(r) => String(r.pid)"
        :max-height="420"
      >
        <template #cell-pid="{ row }">
          <span class="font-mono text-[11.5px]">{{ row.pid }}</span>
        </template>
        <template #cell-usename="{ row }">{{
          row.usename || $t("common.system")
        }}</template>
        <template #cell-application_name="{ row }">
          <span
            class="block max-w-[180px] truncate"
            :title="row.application_name || undefined"
            >{{ row.application_name || "—" }}</span
          >
        </template>
        <template #cell-client_addr="{ row }">
          <span v-if="row.client_addr" class="font-mono text-[11.5px]">{{
            row.client_addr
          }}</span>
          <span v-else class="text-muted-foreground/60">{{
            $t("pages.database.explorer.local")
          }}</span>
        </template>
        <template #cell-state="{ row }">
          <DbStatePill :state="row.state" />
        </template>
        <template #cell-query="{ row }">
          <DbQueryCell :query="row.query" />
        </template>
        <template #cell-query_start="{ row }">
          <span
            v-if="row.query_start"
            :title="new Date(row.query_start).toLocaleString(dateLocale())"
            ><TimeAgo :date="row.query_start" hide-icon
          /></span>
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
        <template #cell-actions="{ row }">
          <DbPidMenu :pid="row.pid" :query="row.query" />
        </template>
      </DbGrid>
    </ManageSection>
  </div>
</template>
