<template>
  <div class="space-y-4">
    <!-- Filters -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex gap-4 items-end">
          <div class="flex-1">
            <Label>Search Query</Label>
            <Input
              v-model="searchQuery"
              type="text"
              placeholder="Filter by query text..."
              class="mt-1.5"
            />
          </div>
          <div>
            <Label>Min Calls</Label>
            <Input
              v-model.number="minCalls"
              type="number"
              placeholder="5"
              class="w-24 mt-1.5"
            />
          </div>
          <div class="w-40">
            <Label>Sort By</Label>
            <Select v-model="sortBy">
              <SelectTrigger class="mt-1.5">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mean_exec_time">Avg Time</SelectItem>
                <SelectItem value="max_exec_time">Max Time</SelectItem>
                <SelectItem value="calls">Calls</SelectItem>
                <SelectItem value="total_exec_time">Total Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Query Stats Table -->
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Query</TableHead>
            <TableHead class="text-right">Calls</TableHead>
            <TableHead class="text-right">Avg Time (ms)</TableHead>
            <TableHead class="text-right">Max Time (ms)</TableHead>
            <TableHead class="text-right">Cache Hit %</TableHead>
            <TableHead class="text-right">Temp Blocks</TableHead>
            <TableHead class="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="stat in filteredStats"
            :key="stat.queryid"
            class="cursor-pointer"
            @click="openDetail(stat.queryid)"
          >
            <TableCell class="max-w-md">
              <div class="flex items-center gap-2">
                <div
                  class="overflow-x-auto max-h-20 font-mono text-xs whitespace-nowrap flex-1"
                >
                  {{ stat.query }}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  class="shrink-0 h-6 w-6 p-0"
                  @click.stop="copyQuery(stat.query)"
                >
                  <CopyIcon class="w-3 h-3" />
                </Button>
              </div>
            </TableCell>
            <TableCell class="text-right">{{
              stat.calls.toLocaleString()
            }}</TableCell>
            <TableCell class="text-right font-medium">
              <Badge :variant="getTimeVariant(stat.mean_exec_time)">
                {{ stat.mean_exec_time.toFixed(2) }}
              </Badge>
            </TableCell>
            <TableCell class="text-right">{{
              stat.max_exec_time.toFixed(2)
            }}</TableCell>
            <TableCell class="text-right">
              <span v-if="stat.cache_hit_ratio !== null">
                {{ (stat.cache_hit_ratio * 100).toFixed(1) }}%
              </span>
              <span v-else class="text-muted-foreground">N/A</span>
            </TableCell>
            <TableCell class="text-right">
              <Badge v-if="stat.temp_blks_written > 0" variant="destructive">
                {{ stat.temp_blks_written.toLocaleString() }}
              </Badge>
              <span v-else class="text-muted-foreground">0</span>
            </TableCell>
            <TableCell class="text-center">
              <Button
                @click.stop="openDetail(stat.queryid)"
                variant="ghost"
                size="sm"
              >
                Details
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Empty v-if="filteredStats.length === 0">
        <p class="text-muted-foreground">
          {{ $t("pages.database.query_performance.no_stats") }}
        </p>
      </Empty>
    </Card>

    <!-- Query Detail Modal -->
    <QueryDetailModal
      v-if="selectedQueryId"
      :queryid="selectedQueryId"
      @close="selectedQueryId = null"
    />
  </div>
</template>

<script lang="ts">
import { CopyIcon } from "lucide-vue-next";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QueryDetailModal from "./QueryDetailModal.vue";
import { generateQuery } from "~/graphql/graphqlGen";

export default {
  components: {
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Empty,
    Badge,
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    QueryDetailModal,
    CopyIcon,
  },
  inject: ["pollInterval"],
  data() {
    return {
      queryStats: [] as any[],
      searchQuery: "",
      minCalls: 5,
      sortBy: "mean_exec_time",
      selectedQueryId: null as string | null,
    };
  },
  computed: {
    filteredStats() {
      let stats = [...this.queryStats];

      if (this.searchQuery) {
        const search = this.searchQuery.toLowerCase();
        stats = stats.filter((s) => s.query.toLowerCase().includes(search));
      }

      if (this.minCalls > 0) {
        stats = stats.filter((s) => s.calls >= this.minCalls);
      }

      stats.sort((a, b) => {
        const aVal = a[this.sortBy] || 0;
        const bVal = b[this.sortBy] || 0;
        return bVal - aVal;
      });

      return stats;
    },
  },
  methods: {
    getTimeVariant(meanTime: number) {
      if (meanTime > 100) return "destructive";
      if (meanTime > 10) return "secondary";
      return "default";
    },
    openDetail(queryid: string) {
      this.selectedQueryId = queryid;
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
      update: (data: any) => data.getQueryStats,
      pollInterval() {
        return this.pollInterval();
      },
    },
  },
};
</script>
