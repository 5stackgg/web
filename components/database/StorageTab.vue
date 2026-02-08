<template>
  <div class="space-y-6">
    <!-- Schema Selector -->
    <div class="flex justify-end">
      <SchemaSelector @change="handleSchemaChange" />
    </div>

    <!-- Summary Cards -->
    <div>
      <h3 class="text-lg font-semibold mb-3">
        {{ $t("pages.database.storage.overview") }}
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ $t("pages.database.storage.total_database_size") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatBytes(storageStats?.summary?.total_database_size || 0) }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ $t("pages.database.storage.total_table_size") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatBytes(storageStats?.summary?.total_table_size || 0) }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ $t("pages.database.storage.total_indexes_size") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatBytes(storageStats?.summary?.total_indexes_size || 0) }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ $t("pages.database.storage.reclaimable_space") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{
                formatBytes(
                  storageStats?.summary?.estimated_reclaimable_space || 0,
                )
              }}
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ $t("pages.database.storage.from_dead_tuples") }}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Table Details -->
    <div>
      <h3 class="text-lg font-semibold mb-3">
        {{ $t("pages.database.storage.table_sizes") }}
      </h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ $t("pages.database.storage.schema") }}</TableHead>
              <TableHead>{{ $t("pages.database.storage.table") }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.storage.total_size")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.storage.table_size")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.storage.indexes_size")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.storage.live_tuples")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.storage.dead_tuples")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.storage.dead_tuple_size")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="table in storageStats?.tables || []"
              :key="`${table.schemaname}.${table.tablename}`"
            >
              <TableCell class="text-xs">{{ table.schemaname }}</TableCell>
              <TableCell class="font-mono text-xs">{{
                table.tablename
              }}</TableCell>
              <TableCell class="text-right font-semibold">{{
                formatBytes(table.total_size)
              }}</TableCell>
              <TableCell class="text-right text-xs">{{
                formatBytes(table.table_size)
              }}</TableCell>
              <TableCell class="text-right text-xs">{{
                formatBytes(table.indexes_size)
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
              <TableCell class="text-right">
                <Badge
                  v-if="table.estimated_dead_tuple_bytes > 1048576"
                  variant="destructive"
                >
                  {{ formatBytes(table.estimated_dead_tuple_bytes) }}
                </Badge>
                <span v-else class="text-xs">{{
                  formatBytes(table.estimated_dead_tuple_bytes)
                }}</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Empty v-if="!storageStats?.tables || storageStats.tables.length === 0">
          <p class="text-muted-foreground">
            {{ $t("pages.database.storage.no_tables") }}
          </p>
        </Empty>
      </Card>
    </div>
  </div>
</template>

<script lang="ts">
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
    SchemaSelector,
  },
  inject: ["pollInterval", "refreshTrigger"],
  data() {
    return {
      storageStats: null as any,
      selectedSchemas: ["public"] as string[],
    };
  },
  methods: {
    handleSchemaChange(schemas: string[]) {
      this.selectedSchemas = schemas;
      if (this.$apollo.queries.storageStats) {
        this.$apollo.queries.storageStats.refetch();
      }
    },
    formatBytes(bytes: number): string {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    },
    getDeadTupleVariant(dead: number, live: number): string {
      if (live === 0) return "secondary";
      const ratio = dead / live;
      if (ratio > 0.2) return "destructive";
      if (ratio > 0.1) return "secondary";
      return "default";
    },
  },
  apollo: {
    storageStats: {
      query() {
        return generateQuery({
          getStorageStats: [
            this.selectedSchemas.length > 0
              ? { schemas: this.selectedSchemas }
              : {},
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
      if (this.$apollo.queries.storageStats) {
        this.$apollo.queries.storageStats.refetch();
      }
    },
  },
};
</script>
