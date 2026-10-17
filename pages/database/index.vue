<script setup lang="ts">
import { PanelLeft, Pause, Play, RefreshCw } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import DbTree from "~/components/database/DbTree.vue";
import DbOverview from "~/components/database/DbOverview.vue";
import DbTablePage from "~/components/database/DbTablePage.vue";
import QueryPerformanceTab from "~/components/database/QueryPerformanceTab.vue";
import ConnectionsTab from "~/components/database/ConnectionsTab.vue";
import LocksTransactionsTab from "~/components/database/LocksTransactionsTab.vue";
import IOBufferStatsTab from "~/components/database/IOBufferStatsTab.vue";
import IndexUsageTab from "~/components/database/IndexUsageTab.vue";
import StorageTab from "~/components/database/StorageTab.vue";
import TimescaleTab from "~/components/database/TimescaleTab.vue";
import BackupsTab from "~/components/database/BackupsTab.vue";
import QueryDetailModal from "~/components/database/QueryDetailModal.vue";

definePageMeta({
  middleware: "admin",
  // The open table is a place inside the explorer, not another page: without
  // this the page key changes on every pick and the whole route remounts.
  persistQueryKeys: ["table"],
});
</script>

<template>
  <div class="grid gap-4">
    <h1 class="sr-only">{{ $t("layouts.app_nav.system.database") }}</h1>

    <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2.5">
      <button
        type="button"
        class="inline-flex h-8 min-w-0 max-w-full items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        :aria-expanded="treeOpen"
        @click="treeOpen = !treeOpen"
      >
        <PanelLeft class="h-4 w-4 shrink-0" />
        <span class="truncate font-mono text-xs">{{ currentLabel }}</span>
      </button>

      <div class="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <span>{{ $t("pages.database.explorer.slow_over") }}</span>
        <AnimatedFilters
          v-model="thresholdKey"
          square
          :options="thresholdOptions"
          :aria-label="$t('pages.database.explorer.slow_threshold')"
        />
      </div>

      <div class="ml-auto flex items-center gap-1.5">
        <span
          class="mr-1 whitespace-nowrap text-xs tabular-nums text-muted-foreground"
          >{{ updatedLabel }}</span
        >
        <FiveStackToolTip as-child :delay-duration="120">
          <template #trigger>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-md border border-border bg-muted/30 text-muted-foreground transition-colors hover:text-foreground"
              :aria-label="$t('pages.database.explorer.refresh_now')"
              @click="refreshNow"
            >
              <RefreshCw
                :key="spinKey"
                class="h-3.5 w-3.5"
                :class="spinKey > 0 && 'db-spin-once'"
              />
            </button>
          </template>
          {{ $t("pages.database.explorer.refresh_now") }}
        </FiveStackToolTip>
        <Select v-model="refreshInterval" :disabled="isPaused">
          <SelectTrigger
            class="h-8 w-auto gap-1.5 rounded-md bg-muted/30 px-2.5 text-xs"
            :aria-label="$t('pages.database.explorer.refresh_every')"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="s in intervals" :key="s" :value="String(s)">
              {{ $t("pages.database.explorer.every_seconds", { seconds: s }) }}
            </SelectItem>
          </SelectContent>
        </Select>
        <FiveStackToolTip as-child :delay-duration="120">
          <template #trigger>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-md border transition-colors"
              :class="
                isPaused
                  ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                  : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
              "
              :aria-pressed="isPaused"
              :aria-label="
                isPaused
                  ? $t('pages.database.explorer.resume_refreshing')
                  : $t('pages.database.explorer.pause_refreshing')
              "
              @click="togglePause"
            >
              <Play v-if="isPaused" class="h-3.5 w-3.5" />
              <Pause v-else class="h-3.5 w-3.5" />
            </button>
          </template>
          {{
            isPaused
              ? $t("pages.database.explorer.resume_refreshing")
              : $t("pages.database.explorer.pause_refreshing")
          }}
        </FiveStackToolTip>
      </div>
    </div>

    <div class="grid min-h-[640px] min-w-0 lg:grid-cols-[270px_minmax(0,1fr)]">
      <DbTree
        :current="view"
        :tables="tables"
        :table-sev="tableSev"
        :schemas="schemas"
        :queries="queryStats"
        :active="activeQueries"
        :locks="currentLocks"
        :connection-stats="connectionStats"
        :timescale="timescaleStats"
        :threshold="threshold"
        :open="treeOpen"
        @go="go"
        @update:schemas="setSchemas"
      />

      <section class="min-w-0 pb-7 pt-4 lg:pl-6 lg:pt-0" aria-live="polite">
        <Transition
          mode="out-in"
          enter-active-class="db-swap-enter"
          enter-from-class="db-swap-from"
          leave-active-class="db-swap-leave"
          leave-to-class="db-swap-to"
        >
          <DbOverview
            v-if="view === 'overview'"
            key="overview"
            :db="db"
            @go="go"
            @open-query="openQuery"
            @view-slow="viewSlowQueries"
            @update:schemas="setSchemas"
          />
          <DbTablePage
            v-else-if="view.startsWith('t:')"
            :key="view"
            :table="currentTable"
            :db="db"
            :table-sev="currentTable ? tableSev[currentTable.key] : ''"
            @go="go"
            @open-query="openQuery"
          />
          <div v-else :key="view" class="grid gap-6">
            <h2 class="text-[19px] font-semibold">{{ currentLabel }}</h2>
            <QueryPerformanceTab
              v-if="view === 'queries'"
              v-model:slow-only="querySlowOnly"
              v-model:sort="querySort"
              :db="db"
              @open-query="openQuery"
            />
            <ConnectionsTab v-else-if="view === 'connections'" :db="db" />
            <LocksTransactionsTab
              v-else-if="view === 'locks'"
              :db="db"
              @update:schemas="setSchemas"
            />
            <IOBufferStatsTab
              v-else-if="view === 'io'"
              :db="db"
              @update:schemas="setSchemas"
            />
            <IndexUsageTab
              v-else-if="view === 'index-usage'"
              :db="db"
              @go="go"
              @update:schemas="setSchemas"
            />
            <StorageTab
              v-else-if="view === 'storage'"
              :db="db"
              @go="go"
              @update:schemas="setSchemas"
            />
            <TimescaleTab v-else-if="view === 'timescale'" :db="db" />
            <BackupsTab v-else-if="view === 'backups'" />
          </div>
        </Transition>
      </section>
    </div>

    <QueryDetailModal
      v-if="selectedQueryId"
      :key="selectedQueryId"
      :queryid="selectedQueryId"
      :threshold="threshold"
      @close="selectedQueryId = null"
    />
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import {
  SERVER_LABEL_KEYS,
  SERVER_VIEWS,
  SLOW_THRESHOLDS,
  UNUSED_INDEX_FLOOR,
  relationMatches,
  thresholdLabel,
  cacheRatio,
  readSchemas,
  readSlowThreshold,
  saveSchemas,
  saveSlowThreshold,
  slowSeverityFor,
  tableSeverity,
  type Sev,
} from "~/components/database/dbHealth";

export default {
  data() {
    return {
      threshold: readSlowThreshold(),
      schemas: readSchemas() as string[],
      refreshInterval: "5",
      intervals: [3, 5, 10, 15, 30, 60],
      isPaused: false,
      lastUpdated: 0,
      now: Date.now(),
      clock: undefined as ReturnType<typeof setInterval> | undefined,
      spinKey: 0,
      treeOpen: false,
      querySlowOnly: false,
      querySort: "mean_exec_time",
      selectedQueryId: null as string | null,
      activeFetchedAt: Date.now(),

      queryStats: [] as any[],
      activeQueries: [] as any[],
      activeConnections: [] as any[],
      connectionStats: null as any,
      databaseStats: null as any,
      currentLocks: [] as any[],
      storageStats: null as any,
      tableStats: [] as any[],
      tableIOStats: [] as any[],
      indexStats: [] as any[],
      indexIOStats: [] as any[],
      timescaleStats: null as any,
      loaded: {} as Record<string, boolean>,
    };
  },
  mounted() {
    this.clock = setInterval(() => (this.now = Date.now()), 1000);
  },
  beforeUnmount() {
    clearInterval(this.clock);
  },
  computed: {
    view(): string {
      const table = this.$route.query.table;
      if (typeof table === "string" && table.includes(".")) {
        return `t:${table}`;
      }
      const tab = this.$route.query.tab;
      if (
        typeof tab === "string" &&
        (SERVER_VIEWS as readonly string[]).includes(tab)
      ) {
        return tab;
      }
      return "overview";
    },
    thresholdKey: {
      get(): string {
        return String(this.threshold);
      },
      set(value: string) {
        this.threshold = Number(value);
        saveSlowThreshold(this.threshold);
      },
    },
    thresholdOptions() {
      return SLOW_THRESHOLDS.map((ms) => ({
        key: String(ms),
        label: thresholdLabel(ms),
      }));
    },
    pollMs(): number {
      return this.isPaused ? 0 : parseInt(this.refreshInterval) * 1000;
    },
    updatedLabel(): string {
      const s = this.lastUpdated
        ? Math.max(0, Math.round((this.now - this.lastUpdated) / 1000))
        : null;
      const prefix = this.isPaused ? "paused" : "updated";
      return s === null || s < 2
        ? this.$t(`pages.database.explorer.${prefix}_just_now`)
        : this.$t(`pages.database.explorer.${prefix}_seconds_ago`, {
            seconds: s,
          });
    },
    currentLabel(): string {
      if (this.view.startsWith("t:")) return this.view.slice(2);
      return this.$t(
        SERVER_LABEL_KEYS[this.view] || SERVER_LABEL_KEYS.overview,
      );
    },
    needs(): Record<string, boolean> {
      const v = this.view;
      const table = v.startsWith("t:");
      return {
        tableStats: v === "overview" || v === "locks" || table,
        tableIO: v === "overview" || v === "io" || table,
        indexIO: v === "io" || table,
        databaseStats: v === "overview" || v === "locks",
        connections: v === "connections",
      };
    },
    hypertables(): Set<string> {
      return new Set(
        (this.timescaleStats?.hypertables || []).map(
          (h: any) => h.hypertable_name,
        ),
      );
    },
    indexes(): any[] {
      const io = new Map<string, any>();
      for (const row of this.indexIOStats || []) {
        io.set(`${row.schemaname}.${row.indexname}`, row);
      }
      return (this.indexStats || []).map((row: any) => {
        const blocks = io.get(`${row.schemaname}.${row.indexname}`);
        const hit = blocks?.idx_blks_hit ?? null;
        const read = blocks?.idx_blks_read ?? null;
        return {
          ...row,
          idx_blks_hit: hit,
          idx_blks_read: read,
          cache_hit_ratio: blocks ? cacheRatio(hit, read) : null,
        };
      });
    },
    tables(): any[] {
      const byKey = new Map<string, any>();
      const ensure = (schema: string, name: string) => {
        const key = `${schema}.${name}`;
        let row = byKey.get(key);
        if (!row) {
          row = {
            key,
            schemaname: schema,
            relname: name,
            hyper: this.hypertables.has(name),
            indexes: [] as any[],
          };
          byKey.set(key, row);
        }
        return row;
      };
      for (const t of this.storageStats?.tables || []) {
        Object.assign(ensure(t.schemaname, t.tablename), {
          total_size: t.total_size,
          table_size: t.table_size,
          indexes_size: t.indexes_size,
          n_live_tup: t.n_live_tup,
          n_dead_tup: t.n_dead_tup,
          estimated_dead_tuple_bytes: t.estimated_dead_tuple_bytes,
        });
      }
      for (const t of this.tableStats || []) {
        const row = ensure(t.schemaname, t.relname);
        const { schemaname, relname, ...rest } = t;
        Object.assign(row, rest);
      }
      for (const t of this.tableIOStats || []) {
        const row = ensure(t.schemaname, t.relname);
        Object.assign(row, {
          heap_blks_read: t.heap_blks_read,
          heap_blks_hit: t.heap_blks_hit,
          idx_blks_read: t.idx_blks_read,
          idx_blks_hit: t.idx_blks_hit,
          cache_hit_ratio: t.cache_hit_ratio,
        });
      }
      for (const index of this.indexes) {
        const row = byKey.get(`${index.schemaname}.${index.tablename}`);
        if (row) row.indexes.push(index);
      }
      return [...byKey.values()].filter((t) =>
        this.schemas.includes(t.schemaname),
      );
    },
    tableSev(): Record<string, Sev> {
      const out: Record<string, Sev> = {};
      const waiting = this.currentLocks.filter((l: any) => !l.granted);
      for (const t of this.tables) {
        out[t.key] = tableSeverity({
          live: t.n_live_tup || 0,
          dead: t.n_dead_tup || 0,
          lockWaiting: waiting.some((l: any) =>
            relationMatches(l.relation, t.schemaname, t.relname),
          ),
          unusedIndex: t.indexes.some(
            (i: any) => i.idx_scan === 0 && i.index_size > UNUSED_INDEX_FLOOR,
          ),
          slow: slowSeverityFor(this.queryStats, t.relname, this.threshold),
        });
      }
      return out;
    },
    currentTable(): any {
      if (!this.view.startsWith("t:")) return null;
      const key = this.view.slice(2);
      return this.tables.find((t: any) => t.key === key) || null;
    },
    db(): Record<string, any> {
      return {
        threshold: this.threshold,
        schemas: this.schemas,
        queries: this.queryStats,
        active: this.activeQueries,
        activeFetchedAt: this.activeFetchedAt,
        connections: this.activeConnections,
        connectionStats: this.connectionStats,
        databaseStats: this.databaseStats,
        locks: this.currentLocks,
        tables: this.tables,
        indexes: this.indexes.filter((i: any) =>
          this.schemas.includes(i.schemaname),
        ),
        storage: this.storageStats?.summary || null,
        timescale: this.timescaleStats,
        loaded: this.loaded,
      };
    },
  },
  watch: {
    view() {
      this.treeOpen = false;
    },
  },
  methods: {
    go(key: string) {
      const query: Record<string, string> = {};
      for (const [k, v] of Object.entries(this.$route.query)) {
        if (k !== "tab" && k !== "table" && typeof v === "string") {
          query[k] = v;
        }
      }
      if (key.startsWith("t:")) {
        query.table = key.slice(2);
      } else if (key !== "overview") {
        query.tab = key;
      }
      if (key !== "queries") {
        this.querySlowOnly = false;
      }
      void this.$router.replace({ query });
    },
    viewSlowQueries() {
      this.go("queries");
      this.querySlowOnly = true;
      this.querySort = "mean_exec_time";
    },
    openQuery(queryid: string) {
      this.selectedQueryId = queryid;
    },
    setSchemas(schemas: string[]) {
      this.schemas = [...schemas];
      saveSchemas(this.schemas);
    },
    togglePause() {
      this.isPaused = !this.isPaused;
      if (!this.isPaused) this.refreshNow(false);
    },
    refreshNow(spin = true) {
      if (spin) this.spinKey++;
      const queries = this.$apollo.queries as Record<string, any>;
      for (const name of Object.keys(queries)) {
        const q = queries[name];
        if (q && !q.skip) {
          void q.refetch();
        }
      }
    },
    landed(name: string) {
      this.lastUpdated = Date.now();
      if (!this.loaded[name]) {
        this.loaded = { ...this.loaded, [name]: true };
      }
    },
  },
  apollo: {
    queryStats: {
      query: generateQuery({
        getQueryStats: [
          {},
          {
            queryid: true,
            query: true,
            calls: true,
            total_exec_time: true,
            mean_exec_time: true,
            stddev_exec_time: true,
            min_exec_time: true,
            max_exec_time: true,
            total_rows: true,
            shared_blks_hit: true,
            shared_blks_read: true,
            cache_hit_ratio: true,
            temp_blks_written: true,
            local_blks_hit: true,
            local_blks_read: true,
          },
        ],
      }),
      update: (data: any) => (data.getQueryStats || []).filter(Boolean),
      result() {
        this.landed("queries");
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    activeQueries: {
      query: generateQuery({
        getActiveQueries: [
          {},
          {
            pid: true,
            usename: true,
            application_name: true,
            client_addr: true,
            state: true,
            wait_event_type: true,
            wait_event: true,
            query: true,
            query_start: true,
            duration_seconds: true,
          },
        ],
      }),
      update: (data: any) => (data.getActiveQueries || []).filter(Boolean),
      result() {
        this.activeFetchedAt = Date.now();
        this.landed("active");
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    activeConnections: {
      query: generateQuery({
        getActiveConnections: [
          {},
          {
            pid: true,
            usename: true,
            application_name: true,
            client_addr: true,
            state: true,
            query: true,
            query_start: true,
          },
        ],
      }),
      update: (data: any) => (data.getActiveConnections || []).filter(Boolean),
      result() {
        this.landed("connections");
      },
      skip() {
        return !this.needs.connections;
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    connectionStats: {
      query: generateQuery({
        getConnectionStats: [
          {},
          {
            total: true,
            active: true,
            idle: true,
            idle_in_transaction: true,
            by_state: {
              state: true,
              count: true,
              wait_event_type: true,
            },
          },
        ],
      }),
      update: (data: any) => data.getConnectionStats,
      result() {
        this.landed("connectionStats");
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    databaseStats: {
      query: generateQuery({
        getDatabaseStats: [
          {},
          {
            datname: true,
            numbackends: true,
            xact_commit: true,
            xact_rollback: true,
            blks_read: true,
            blks_hit: true,
            cache_hit_ratio: true,
            tup_returned: true,
            tup_fetched: true,
            tup_inserted: true,
            tup_updated: true,
            tup_deleted: true,
            conflicts: true,
            deadlocks: true,
          },
        ],
      }),
      update: (data: any) => data.getDatabaseStats,
      result() {
        this.landed("databaseStats");
      },
      skip() {
        return !this.needs.databaseStats;
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    currentLocks: {
      query: generateQuery({
        getCurrentLocks: [
          {},
          {
            locktype: true,
            relation: true,
            mode: true,
            granted: true,
            usename: true,
            query: true,
            pid: true,
          },
        ],
      }),
      update: (data: any) => (data.getCurrentLocks || []).filter(Boolean),
      result() {
        this.landed("locks");
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    storageStats: {
      query() {
        return generateQuery({
          getStorageStats: [
            { schemas: this.schemas },
            {
              summary: {
                total_database_size: true,
                total_table_size: true,
                total_indexes_size: true,
                estimated_reclaimable_space: true,
              },
              tables: {
                schemaname: true,
                tablename: true,
                total_size: true,
                table_size: true,
                indexes_size: true,
                n_live_tup: true,
                n_dead_tup: true,
                estimated_dead_tuple_bytes: true,
              },
            },
          ],
        });
      },
      update: (data: any) => data.getStorageStats,
      result() {
        this.landed("storage");
      },
      skip() {
        return this.schemas.length === 0;
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    tableStats: {
      query() {
        return generateQuery({
          getTableStats: [
            { schemas: this.schemas },
            {
              schemaname: true,
              relname: true,
              seq_scan: true,
              seq_tup_read: true,
              idx_scan: true,
              idx_tup_fetch: true,
              n_tup_ins: true,
              n_tup_upd: true,
              n_tup_del: true,
              n_tup_hot_upd: true,
              n_live_tup: true,
              n_dead_tup: true,
              last_vacuum: true,
              last_autovacuum: true,
              last_analyze: true,
              last_autoanalyze: true,
            },
          ],
        });
      },
      update: (data: any) => (data.getTableStats || []).filter(Boolean),
      result() {
        this.landed("tableStats");
      },
      skip() {
        return this.schemas.length === 0 || !this.needs.tableStats;
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    tableIOStats: {
      query() {
        return generateQuery({
          getTableIOStats: [
            { schemas: this.schemas },
            {
              schemaname: true,
              relname: true,
              heap_blks_read: true,
              heap_blks_hit: true,
              idx_blks_read: true,
              idx_blks_hit: true,
              cache_hit_ratio: true,
            },
          ],
        });
      },
      update: (data: any) => (data.getTableIOStats || []).filter(Boolean),
      result() {
        this.landed("tableIO");
      },
      skip() {
        return this.schemas.length === 0 || !this.needs.tableIO;
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    indexStats: {
      query() {
        return generateQuery({
          getIndexStats: [
            { schemas: this.schemas },
            {
              schemaname: true,
              tablename: true,
              indexname: true,
              idx_scan: true,
              idx_tup_read: true,
              idx_tup_fetch: true,
              index_size: true,
              table_size: true,
            },
          ],
        });
      },
      update: (data: any) => (data.getIndexStats || []).filter(Boolean),
      result() {
        this.landed("indexes");
      },
      skip() {
        return this.schemas.length === 0;
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    indexIOStats: {
      query() {
        return generateQuery({
          getIndexIOStats: [
            { schemas: this.schemas },
            {
              schemaname: true,
              tablename: true,
              indexname: true,
              idx_blks_read: true,
              idx_blks_hit: true,
            },
          ],
        });
      },
      update: (data: any) => (data.getIndexIOStats || []).filter(Boolean),
      result() {
        this.landed("indexIO");
      },
      skip() {
        return this.schemas.length === 0 || !this.needs.indexIO;
      },
      pollInterval() {
        return this.pollMs;
      },
    },
    timescaleStats: {
      query: generateQuery({
        getTimescaleStats: [
          {},
          {
            hypertables: {
              hypertable_name: true,
              num_chunks: true,
              compression_enabled: true,
            },
            chunks_count: true,
            jobs: {
              job_id: true,
              job_type: true,
              hypertable_name: true,
              last_run_status: true,
              next_start: true,
            },
          },
        ],
      }),
      update: (data: any) => data.getTimescaleStats,
      result() {
        this.landed("timescale");
      },
      pollInterval() {
        return this.pollMs;
      },
    },
  },
};
</script>

<style scoped>
.db-swap-enter {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.db-swap-leave {
  transition:
    opacity 110ms ease-in,
    transform 110ms ease-in;
}
.db-swap-from {
  opacity: 0;
  transform: translateY(4px);
}
.db-swap-to {
  opacity: 0;
}
.db-spin-once {
  animation: db-spin 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes db-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .db-swap-enter,
  .db-swap-leave {
    transition: none;
  }
  .db-spin-once {
    animation: none;
  }
}
</style>
