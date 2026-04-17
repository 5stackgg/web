<template>
  <div class="space-y-6">
    <!-- Schema Selector -->
    <div class="max-w-xs space-y-2">
      <Label class="text-sm">{{ $t("pages.database.columns.schema") }}</Label>
      <SchemaSelector @change="handleSchemaChange" />
    </div>

    <!-- Database Stats Cards -->
    <div>
      <h3 class="text-lg font-semibold mb-3">
        {{ $t("pages.database.locks.stats_title") }}
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">{{
              $t("pages.database.locks.commits")
            }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ databaseStats?.xact_commit?.toLocaleString() || 0 }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">{{
              $t("pages.database.locks.rollbacks")
            }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ databaseStats?.xact_rollback?.toLocaleString() || 0 }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">{{
              $t("pages.database.locks.deadlocks")
            }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ databaseStats?.deadlocks?.toLocaleString() || 0 }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">{{
              $t("pages.database.locks.cache_hit_ratio")
            }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{
                databaseStats
                  ? (databaseStats.cache_hit_ratio * 100).toFixed(1)
                  : 0
              }}%
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Additional Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{
            $t("pages.database.locks.active_backends")
          }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-xl font-semibold">
            {{ databaseStats?.numbackends || 0 }}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{
            $t("pages.database.locks.tuples_inserted")
          }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-xl font-semibold">
            {{ databaseStats?.tup_inserted?.toLocaleString() || 0 }}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{
            $t("pages.database.locks.tuples_updated")
          }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-xl font-semibold">
            {{ databaseStats?.tup_updated?.toLocaleString() || 0 }}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{
            $t("pages.database.locks.tuples_deleted")
          }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-xl font-semibold">
            {{ databaseStats?.tup_deleted?.toLocaleString() || 0 }}
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Current Locks -->
    <div>
      <h3 class="text-lg font-semibold mb-3">
        {{ $t("pages.database.locks.current_locks") }}
      </h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ $t("pages.database.columns.pid") }}</TableHead>
              <TableHead>{{ $t("pages.database.locks.lock_type") }}</TableHead>
              <TableHead>{{
                $t("pages.database.query_performance.relation")
              }}</TableHead>
              <TableHead>{{
                $t("pages.database.query_performance.mode")
              }}</TableHead>
              <TableHead class="text-center">{{
                $t("pages.database.query_performance.granted")
              }}</TableHead>
              <TableHead>{{ $t("pages.database.columns.user") }}</TableHead>
              <TableHead>{{ $t("pages.database.columns.query") }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(lock, index) in currentLocks" :key="index">
              <TableCell>{{ lock.pid }}</TableCell>
              <TableCell class="text-xs">{{ lock.locktype }}</TableCell>
              <TableCell class="text-xs font-mono">{{
                lock.relation || "N/A"
              }}</TableCell>
              <TableCell class="text-xs">{{ lock.mode }}</TableCell>
              <TableCell class="text-center">
                <Badge :variant="lock.granted ? 'default' : 'destructive'">
                  {{ lock.granted ? "Yes" : "No" }}
                </Badge>
              </TableCell>
              <TableCell class="text-xs">{{ lock.usename || "N/A" }}</TableCell>
              <TableCell class="max-w-md">
                <div v-if="lock.query" class="flex items-center gap-2">
                  <div
                    class="overflow-x-auto max-h-20 font-mono text-xs whitespace-nowrap flex-1"
                  >
                    {{ lock.query }}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="shrink-0 h-6 w-6 p-0"
                    @click.stop="copyQuery(lock.query)"
                  >
                    <CopyIcon class="w-3 h-3" />
                  </Button>
                </div>
                <span v-else class="text-muted-foreground text-xs">N/A</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Empty v-if="currentLocks.length === 0">
          <p class="text-muted-foreground">
            {{ $t("pages.database.locks.no_locks") }}
          </p>
        </Empty>
      </Card>
    </div>

    <!-- Table Stats (vacuum info) -->
    <div>
      <h3 class="text-lg font-semibold mb-3">
        {{ $t("pages.database.locks.table_maintenance_title") }}
      </h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ $t("pages.database.columns.schema") }}</TableHead>
              <TableHead>{{ $t("pages.database.columns.table") }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.locks.live_tuples")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.locks.dead_tuples")
              }}</TableHead>
              <TableHead>{{
                $t("pages.database.locks.last_vacuum")
              }}</TableHead>
              <TableHead>{{
                $t("pages.database.locks.last_autovacuum")
              }}</TableHead>
              <TableHead>{{
                $t("pages.database.locks.last_analyze")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="table in tableStats"
              :key="`${table.schemaname}.${table.relname}`"
            >
              <TableCell class="text-xs">{{ table.schemaname }}</TableCell>
              <TableCell class="font-mono text-xs">{{
                table.relname
              }}</TableCell>
              <TableCell class="text-right">{{
                table.n_live_tup.toLocaleString()
              }}</TableCell>
              <TableCell class="text-right">
                <Badge
                  :variant="
                    getDeadTupleVariant(table.n_dead_tup, table.n_live_tup)
                  "
                >
                  {{ table.n_dead_tup.toLocaleString() }}
                </Badge>
              </TableCell>
              <TableCell class="text-xs">{{
                formatDate(table.last_vacuum)
              }}</TableCell>
              <TableCell class="text-xs">{{
                formatDate(table.last_autovacuum)
              }}</TableCell>
              <TableCell class="text-xs">{{
                formatDate(table.last_analyze)
              }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Empty v-if="tableStats.length === 0">
          <p class="text-muted-foreground">
            {{ $t("pages.database.locks.no_table_stats") }}
          </p>
        </Empty>
      </Card>
    </div>
  </div>
</template>

<script lang="ts">
import { CopyIcon } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateQuery } from "~/graphql/graphqlGen";
import SchemaSelector from "./SchemaSelector.vue";

export default {
  components: {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Empty,
    Badge,
    Button,
    Label,
    SchemaSelector,
    CopyIcon,
  },
  inject: ["pollInterval", "refreshTrigger"],
  data() {
    return {
      databaseStats: null as any,
      currentLocks: [] as any[],
      tableStats: [] as any[],
      selectedSchemas: ["public"] as string[],
    };
  },
  methods: {
    handleSchemaChange(schemas: string[]) {
      this.selectedSchemas = schemas;
      if (this.$apollo.queries.tableStats) {
        this.$apollo.queries.tableStats.refetch();
      }
    },
    formatDate(date: string | null) {
      if (!date) return this.$t("common.never");
      return new Date(date).toLocaleString();
    },
    getDeadTupleVariant(dead: number, live: number) {
      if (live === 0) return "secondary";
      const ratio = dead / live;
      if (ratio > 0.2) return "destructive";
      if (ratio > 0.1) return "secondary";
      return "default";
    },
    async copyQuery(query: string) {
      try {
        await navigator.clipboard.writeText(query);
        this.$toast?.success(this.$t("pages.database.query_copied"));
      } catch (error) {
        console.error("Failed to copy:", error);
        this.$toast?.error(this.$t("pages.database.copy_failed"));
      }
    },
  },
  apollo: {
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
      pollInterval() {
        return this.pollInterval();
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
      update: (data: any) => data.getCurrentLocks,
      pollInterval() {
        return this.pollInterval();
      },
    },
    tableStats: {
      query() {
        return generateQuery({
          getTableStats: [
            this.selectedSchemas.length > 0
              ? { schemas: this.selectedSchemas }
              : {},
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
      update: (data: any) => data.getTableStats,
      pollInterval() {
        return this.pollInterval();
      },
      skip() {
        return this.selectedSchemas.length === 0;
      },
    },
  },
  watch: {
    refreshTrigger() {
      // Refetch when manual refresh is triggered
      if (this.$apollo.queries.tableStats) {
        this.$apollo.queries.tableStats.refetch();
      }
    },
  },
};
</script>
