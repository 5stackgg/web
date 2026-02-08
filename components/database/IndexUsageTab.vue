<template>
  <div class="space-y-6">
    <!-- Schema Selector -->
    <div class="flex justify-end">
      <SchemaSelector @change="handleSchemaChange" />
    </div>

    <!-- Index Usage Stats -->
    <div>
      <h3 class="text-lg font-semibold mb-3">
        {{ $t("pages.database.index_usage.title") }}
      </h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{
                $t("pages.database.index_usage.schema")
              }}</TableHead>
              <TableHead>{{
                $t("pages.database.index_usage.table")
              }}</TableHead>
              <TableHead>{{
                $t("pages.database.index_usage.index")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.index_usage.index_scans")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.index_usage.tuples_read")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.index_usage.tuples_fetched")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.index_usage.index_size")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.index_usage.table_size")
              }}</TableHead>
              <TableHead class="text-right">{{
                $t("pages.database.index_usage.size_ratio")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="index in indexStats"
              :key="`${index.schemaname}.${index.indexname}`"
            >
              <TableCell class="text-xs">{{ index.schemaname }}</TableCell>
              <TableCell class="font-mono text-xs">{{
                index.tablename
              }}</TableCell>
              <TableCell class="font-mono text-xs">{{
                index.indexname
              }}</TableCell>
              <TableCell class="text-right">
                <Badge v-if="index.idx_scan === 0" variant="destructive">
                  {{ index.idx_scan.toLocaleString() }}
                </Badge>
                <span v-else>{{ index.idx_scan.toLocaleString() }}</span>
              </TableCell>
              <TableCell class="text-right">{{
                index.idx_tup_read.toLocaleString()
              }}</TableCell>
              <TableCell class="text-right">{{
                index.idx_tup_fetch.toLocaleString()
              }}</TableCell>
              <TableCell class="text-right text-xs">{{
                formatBytes(index.index_size)
              }}</TableCell>
              <TableCell class="text-right text-xs">{{
                formatBytes(index.table_size)
              }}</TableCell>
              <TableCell class="text-right">
                <Badge
                  :variant="
                    getSizeRatioVariant(index.index_size, index.table_size)
                  "
                >
                  {{ getSizeRatioPercent(index.index_size, index.table_size) }}%
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Empty v-if="indexStats.length === 0">
          <p class="text-muted-foreground">
            {{ $t("pages.database.index_usage.no_stats") }}
          </p>
        </Empty>
      </Card>
    </div>
  </div>
</template>

<script lang="ts">
import { Card } from "@/components/ui/card";
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
      indexStats: [] as any[],
      selectedSchemas: ["public"] as string[],
    };
  },
  methods: {
    handleSchemaChange(schemas: string[]) {
      this.selectedSchemas = schemas;
      if (this.$apollo.queries.indexStats) {
        this.$apollo.queries.indexStats.refetch();
      }
    },
    formatBytes(bytes: number): string {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    },
    getSizeRatioPercent(indexSize: number, tableSize: number): string {
      if (tableSize === 0) return "0.0";
      const ratio = (indexSize / tableSize) * 100;
      return ratio.toFixed(1);
    },
    getSizeRatioVariant(indexSize: number, tableSize: number): string {
      if (tableSize === 0) return "secondary";
      const ratio = (indexSize / tableSize) * 100;
      if (ratio > 100) return "destructive"; // Index larger than table
      if (ratio > 50) return "secondary"; // Index is more than 50% of table size
      return "default";
    },
  },
  apollo: {
    indexStats: {
      query() {
        return generateQuery({
          getIndexStats: [
            this.selectedSchemas.length > 0
              ? { schemas: this.selectedSchemas }
              : {},
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
      update: (data: any) => data.getIndexStats,
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
      if (this.$apollo.queries.indexStats) {
        this.$apollo.queries.indexStats.refetch();
      }
    },
  },
};
</script>
