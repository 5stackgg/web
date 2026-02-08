<template>
  <div class="space-y-6">
    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground"
            >Hypertables</CardTitle
          >
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ timescaleStats?.hypertables?.length || 0 }}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground"
            >Total Chunks</CardTitle
          >
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ timescaleStats?.chunks_count || 0 }}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground"
            >Background Jobs</CardTitle
          >
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ timescaleStats?.jobs?.length || 0 }}
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Check if TimescaleDB is installed -->
    <Empty
      v-if="!timescaleStats || timescaleStats.hypertables.length === 0"
      class="p-12"
    >
      <div class="mb-4">
        <svg
          class="w-16 h-16 mx-auto opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p class="text-lg font-medium mb-2">
        {{ $t("pages.database.timescale.no_data_title") }}
      </p>
      <p class="text-sm text-muted-foreground">
        {{ $t("pages.database.timescale.no_data_description") }}
      </p>
    </Empty>

    <!-- Hypertables -->
    <template v-if="timescaleStats && timescaleStats.hypertables.length > 0">
      <div>
        <h3 class="text-lg font-semibold mb-3">Hypertables</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hypertable Name</TableHead>
                <TableHead class="text-right">Chunks</TableHead>
                <TableHead class="text-center">Compression</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="hypertable in timescaleStats.hypertables"
                :key="hypertable.hypertable_name"
              >
                <TableCell class="font-mono">{{
                  hypertable.hypertable_name
                }}</TableCell>
                <TableCell class="text-right">{{
                  hypertable.num_chunks
                }}</TableCell>
                <TableCell class="text-center">
                  <Badge
                    :variant="
                      hypertable.compression_enabled ? 'default' : 'secondary'
                    "
                  >
                    {{
                      hypertable.compression_enabled ? "Enabled" : "Disabled"
                    }}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>

      <!-- Background Jobs -->
      <div>
        <h3 class="text-lg font-semibold mb-3">Background Jobs</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Job Type</TableHead>
                <TableHead>Hypertable</TableHead>
                <TableHead>Last Run Status</TableHead>
                <TableHead>Next Start</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="job in timescaleStats.jobs" :key="job.job_id">
                <TableCell>{{ job.job_id }}</TableCell>
                <TableCell class="text-xs">{{ job.job_type }}</TableCell>
                <TableCell class="font-mono text-xs">{{
                  job.hypertable_name || "N/A"
                }}</TableCell>
                <TableCell>
                  <Badge
                    v-if="job.last_run_status"
                    :variant="getJobStatusVariant(job.last_run_status)"
                  >
                    {{ job.last_run_status }}
                  </Badge>
                  <span v-else class="text-muted-foreground text-xs"
                    >Not run</span
                  >
                </TableCell>
                <TableCell class="text-xs">{{
                  formatDate(job.next_start)
                }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Empty v-if="timescaleStats.jobs.length === 0">
            <p class="text-muted-foreground">
              {{ $t("pages.database.timescale.no_jobs") }}
            </p>
          </Empty>
        </Card>
      </div>
    </template>
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
  },
  inject: ["pollInterval"],
  data() {
    return {
      timescaleStats: null as any,
    };
  },
  methods: {
    formatDate(date: string | null) {
      if (!date) return "Not scheduled";
      return new Date(date).toLocaleString();
    },
    getJobStatusVariant(status: string) {
      if (status === "Success") return "default";
      if (status === "Failed") return "destructive";
      if (status === "Running") return "secondary";
      return "outline";
    },
  },
  apollo: {
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
      pollInterval() {
        return this.pollInterval();
      },
    },
  },
};
</script>
