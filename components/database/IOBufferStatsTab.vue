<template>
  <div class="space-y-4">
    <!-- Schema Selector -->
    <div class="flex justify-end">
      <SchemaSelector @change="handleSchemaChange" />
    </div>

    <Tabs default-value="table" class="w-full">
      <TabsList>
        <TabsTrigger value="table">{{
          $t("pages.database.io.tabs.table_io")
        }}</TabsTrigger>
        <TabsTrigger value="index">{{
          $t("pages.database.io.tabs.index_io")
        }}</TabsTrigger>
      </TabsList>

      <TabsContent value="table" class="space-y-6">
        <!-- Table I/O Stats -->
        <div>
          <h3 class="text-lg font-semibold mb-3">
            {{ $t("pages.database.io.table_io_stats") }}
          </h3>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schema</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead class="text-right">Heap Hits</TableHead>
                  <TableHead class="text-right">Heap Reads</TableHead>
                  <TableHead class="text-right">Index Hits</TableHead>
                  <TableHead class="text-right">Index Reads</TableHead>
                  <TableHead class="text-right">Cache Hit %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="table in tableIOStats"
                  :key="`${table.schemaname}.${table.relname}`"
                >
                  <TableCell class="text-xs">{{ table.schemaname }}</TableCell>
                  <TableCell class="font-mono text-xs">{{
                    table.relname
                  }}</TableCell>
                  <TableCell class="text-right">{{
                    table.heap_blks_hit.toLocaleString()
                  }}</TableCell>
                  <TableCell class="text-right">
                    <Badge v-if="table.heap_blks_read > 0" variant="secondary">
                      {{ table.heap_blks_read.toLocaleString() }}
                    </Badge>
                    <span v-else class="text-muted-foreground">0</span>
                  </TableCell>
                  <TableCell class="text-right">{{
                    table.idx_blks_hit.toLocaleString()
                  }}</TableCell>
                  <TableCell class="text-right">
                    <Badge v-if="table.idx_blks_read > 0" variant="secondary">
                      {{ table.idx_blks_read.toLocaleString() }}
                    </Badge>
                    <span v-else class="text-muted-foreground">0</span>
                  </TableCell>
                  <TableCell class="text-right">
                    <Badge
                      v-if="table.cache_hit_ratio !== null"
                      :variant="getCacheHitVariant(table.cache_hit_ratio)"
                    >
                      {{ (table.cache_hit_ratio * 100).toFixed(1) }}%
                    </Badge>
                    <span v-else class="text-muted-foreground">N/A</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Empty v-if="tableIOStats.length === 0">
              <p class="text-muted-foreground">
                {{ $t("pages.database.io.no_table_stats") }}
              </p>
            </Empty>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="index" class="space-y-6">
        <!-- Index I/O Stats -->
        <div>
          <h3 class="text-lg font-semibold mb-3">
            {{ $t("pages.database.io.index_io_stats") }}
          </h3>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schema</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Index</TableHead>
                  <TableHead class="text-right">Blocks Hit</TableHead>
                  <TableHead class="text-right">Blocks Read</TableHead>
                  <TableHead class="text-right">Cache Hit %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="index in indexIOStats"
                  :key="`${index.schemaname}.${index.indexname}`"
                >
                  <TableCell class="text-xs">{{ index.schemaname }}</TableCell>
                  <TableCell class="font-mono text-xs">{{
                    index.tablename
                  }}</TableCell>
                  <TableCell class="font-mono text-xs">{{
                    index.indexname
                  }}</TableCell>
                  <TableCell class="text-right">{{
                    index.idx_blks_hit.toLocaleString()
                  }}</TableCell>
                  <TableCell class="text-right">
                    <Badge v-if="index.idx_blks_read > 0" variant="secondary">
                      {{ index.idx_blks_read.toLocaleString() }}
                    </Badge>
                    <span v-else class="text-muted-foreground">0</span>
                  </TableCell>
                  <TableCell class="text-right">
                    <Badge
                      :variant="
                        getCacheHitVariant(calculateCacheHitRatio(index))
                      "
                    >
                      {{
                        calculateCacheHitRatio(index) !== null
                          ? (calculateCacheHitRatio(index)! * 100).toFixed(1) +
                            "%"
                          : "N/A"
                      }}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Empty v-if="indexIOStats.length === 0">
              <p class="text-muted-foreground">
                {{ $t("pages.database.io.no_index_io_stats") }}
              </p>
            </Empty>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script lang="ts">
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
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
      tableIOStats: [] as any[],
      indexIOStats: [] as any[],
      selectedSchemas: ["public"] as string[],
    };
  },
  methods: {
    handleSchemaChange(schemas: string[]) {
      this.selectedSchemas = schemas;
      if (this.$apollo.queries.tableIOStats) {
        this.$apollo.queries.tableIOStats.refetch();
      }
      if (this.$apollo.queries.indexIOStats) {
        this.$apollo.queries.indexIOStats.refetch();
      }
    },
    getCacheHitVariant(ratio: number | null) {
      if (ratio === null) return "secondary";
      if (ratio < 0.8) return "destructive";
      if (ratio < 0.95) return "secondary";
      return "default";
    },
    calculateCacheHitRatio(index: any): number | null {
      const total = index.idx_blks_hit + index.idx_blks_read;
      if (total === 0) return null;
      return index.idx_blks_hit / total;
    },
  },
  apollo: {
    tableIOStats: {
      query() {
        return generateQuery({
          getTableIOStats: [
            this.selectedSchemas.length > 0
              ? { schemas: this.selectedSchemas }
              : {},
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
      update: (data: any) => data.getTableIOStats,
      pollInterval() {
        return this.pollInterval();
      },
      skip() {
        return this.selectedSchemas.length === 0;
      },
    },
    indexIOStats: {
      query() {
        return generateQuery({
          getIndexIOStats: [
            this.selectedSchemas.length > 0
              ? { schemas: this.selectedSchemas }
              : {},
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
      update: (data: any) => data.getIndexIOStats,
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
      if (this.$apollo.queries.tableIOStats) {
        this.$apollo.queries.tableIOStats.refetch();
      }
      if (this.$apollo.queries.indexIOStats) {
        this.$apollo.queries.indexIOStats.refetch();
      }
    },
  },
};
</script>
