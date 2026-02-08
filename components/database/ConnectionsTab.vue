<template>
  <div class="space-y-6">
    <!-- Connection Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ connectionStats?.total || 0 }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">Active</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ connectionStats?.active || 0 }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">Idle</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ connectionStats?.idle || 0 }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">Idle in Txn</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ connectionStats?.idle_in_transaction || 0 }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">Waiting</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ connectionStats?.waiting || 0 }}</div>
        </CardContent>
      </Card>
    </div>

    <!-- Active Queries Section -->
    <div>
      <h3 class="text-lg font-semibold mb-3">Active Queries</h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>App</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Wait Event</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Query</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="query in activeQueries" :key="query.pid">
              <TableCell>{{ query.pid }}</TableCell>
              <TableCell>{{ query.usename }}</TableCell>
              <TableCell class="text-xs">{{ query.application_name || 'N/A' }}</TableCell>
              <TableCell>
                <Badge :variant="getStateVariant(query.state)">
                  {{ query.state }}
                </Badge>
              </TableCell>
              <TableCell class="text-xs">
                <span v-if="query.wait_event_type">
                  {{ query.wait_event_type }}
                  <span v-if="query.wait_event" class="text-muted-foreground">
                    ({{ query.wait_event }})
                  </span>
                </span>
                <span v-else class="text-muted-foreground">None</span>
              </TableCell>
              <TableCell>
                <Badge :variant="getDurationVariant(query.duration_seconds)">
                  {{ formatDuration(query.duration_seconds) }}
                </Badge>
              </TableCell>
              <TableCell class="max-w-md">
                <div class="flex items-center gap-2">
                  <div class="overflow-x-auto max-h-20 font-mono text-xs whitespace-nowrap flex-1">
                    {{ query.query }}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="shrink-0 h-6 w-6 p-0"
                    @click.stop="copyQuery(query.query)"
                  >
                    <CopyIcon class="w-3 h-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Empty v-if="activeQueries.length === 0">
          <p class="text-muted-foreground">{{ $t('pages.database.connections.no_active_queries') }}</p>
        </Empty>
      </Card>
    </div>

    <!-- All Connections -->
    <div>
      <h3 class="text-lg font-semibold mb-3">All Connections</h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Query</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="conn in activeConnections" :key="conn.pid">
              <TableCell>{{ conn.pid }}</TableCell>
              <TableCell>{{ conn.usename || 'System' }}</TableCell>
              <TableCell class="text-xs">{{ conn.application_name || 'N/A' }}</TableCell>
              <TableCell class="text-xs">{{ conn.client_addr || 'local' }}</TableCell>
              <TableCell>
                <Badge v-if="conn.state" :variant="getStateVariant(conn.state)">
                  {{ conn.state }}
                </Badge>
                <span v-else class="text-muted-foreground text-xs">N/A</span>
              </TableCell>
              <TableCell class="max-w-md">
                <div v-if="conn.query" class="flex items-center gap-2">
                  <div class="overflow-x-auto max-h-20 font-mono text-xs whitespace-nowrap flex-1">
                    {{ conn.query }}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="shrink-0 h-6 w-6 p-0"
                    @click.stop="copyQuery(conn.query)"
                  >
                    <CopyIcon class="w-3 h-3" />
                  </Button>
                </div>
                <span v-else class="text-muted-foreground text-xs">N/A</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Empty v-if="activeConnections.length === 0">
          <p class="text-muted-foreground">{{ $t('pages.database.connections.no_connections') }}</p>
        </Empty>
      </Card>
    </div>
  </div>
</template>

<script lang="ts">
import { CopyIcon } from 'lucide-vue-next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  inject: ['pollInterval'],
  data() {
    return {
      connectionStats: null as any,
      activeQueries: [] as any[],
      activeConnections: [] as any[],
    };
  },
  methods: {
    getStateVariant(state: string) {
      if (state === 'active') return 'default';
      if (state === 'idle') return 'secondary';
      if (state === 'idle in transaction') return 'outline';
      return 'secondary';
    },
    getDurationVariant(seconds: number) {
      if (seconds > 60) return 'destructive';
      if (seconds > 10) return 'secondary';
      return 'default';
    },
    formatDuration(seconds: number) {
      if (seconds < 60) return `${seconds.toFixed(1)}s`;
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}m ${secs}s`;
    },
    async copyQuery(query: string) {
      try {
        await navigator.clipboard.writeText(query);
        this.$toast?.success(this.$t('pages.database.query_copied'));
      } catch (error) {
        console.error('Failed to copy:', error);
        this.$toast?.error(this.$t('pages.database.copy_failed'));
      }
    },
  },
  apollo: {
    connectionStats: {
      query: generateQuery({
        getConnectionStats: [
          {},
          {
            total: true,
            active: true,
            idle: true,
            idle_in_transaction: true,
            waiting: true,
            by_state: {
              state: true,
              count: true,
              wait_event_type: true,
              waiting_count: true,
            },
          },
        ],
      }),
      update: (data: any) => data.getConnectionStats,
      pollInterval() {
        return this.pollInterval();
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
      update: (data: any) => data.getActiveQueries,
      pollInterval() {
        return this.pollInterval();
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
      update: (data: any) => data.getActiveConnections,
      pollInterval() {
        return this.pollInterval();
      },
    },
  },
};
</script>
