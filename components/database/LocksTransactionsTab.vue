<template>
  <div class="space-y-6">
    <!-- Database Stats Cards -->
    <div>
      <h3 class="text-lg font-semibold mb-3">Database Statistics</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground"
              >Commits</CardTitle
            >
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ databaseStats?.xact_commit?.toLocaleString() || 0 }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground"
              >Rollbacks</CardTitle
            >
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ databaseStats?.xact_rollback?.toLocaleString() || 0 }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground"
              >Deadlocks</CardTitle
            >
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ databaseStats?.deadlocks?.toLocaleString() || 0 }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground"
              >Cache Hit Ratio</CardTitle
            >
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
          <CardTitle class="text-sm font-medium text-muted-foreground"
            >Active Backends</CardTitle
          >
        </CardHeader>
        <CardContent>
          <div class="text-xl font-semibold">
            {{ databaseStats?.numbackends || 0 }}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground"
            >Tuples Inserted</CardTitle
          >
        </CardHeader>
        <CardContent>
          <div class="text-xl font-semibold">
            {{ databaseStats?.tup_inserted?.toLocaleString() || 0 }}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground"
            >Tuples Updated</CardTitle
          >
        </CardHeader>
        <CardContent>
          <div class="text-xl font-semibold">
            {{ databaseStats?.tup_updated?.toLocaleString() || 0 }}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground"
            >Tuples Deleted</CardTitle
          >
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
      <h3 class="text-lg font-semibold mb-3">Current Locks</h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PID</TableHead>
              <TableHead>Lock Type</TableHead>
              <TableHead>Relation</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead class="text-center">Granted</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Query</TableHead>
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
      <h3 class="text-lg font-semibold mb-3">Table Maintenance Statistics</h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Schema</TableHead>
              <TableHead>Table</TableHead>
              <TableHead class="text-right">Live Tuples</TableHead>
              <TableHead class="text-right">Dead Tuples</TableHead>
              <TableHead>Last Vacuum</TableHead>
              <TableHead>Last Autovacuum</TableHead>
              <TableHead>Last Analyze</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="table in filteredTableStats.slice(0, 20)"
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
        <Empty v-if="filteredTableStats.length === 0">
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
import { generateQuery } from "~/graphql/graphqlGen";

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
    CopyIcon,
  },
  inject: ["pollInterval", "selectedSchemas"],
  data() {
    return {
      databaseStats: null as any,
      currentLocks: [] as any[],
      tableStats: [] as any[],
    };
  },
  computed: {
    filteredTableStats() {
      const schemas = this.selectedSchemas();
      if (schemas.length === 0) return this.tableStats;
      return this.tableStats.filter((stat: any) =>
        schemas.includes(stat.schemaname),
      );
    },
  },
  methods: {
    formatDate(date: string | null) {
      if (!date) return "Never";
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
      query: generateQuery({
        getTableStats: [
          {},
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
      }),
      update: (data: any) => data.getTableStats,
      pollInterval() {
        return this.pollInterval();
      },
    },
  },
};
</script>
