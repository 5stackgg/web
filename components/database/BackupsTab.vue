<template>
  <div>
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{
              $t("pages.settings.application.db_backups.name")
            }}</TableHead>
            <TableHead class="text-right">{{
              $t("pages.settings.application.db_backups.size")
            }}</TableHead>
            <TableHead>{{
              $t("pages.settings.application.db_backups.created_at")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody v-if="backups.length">
          <TableRow v-for="backup in backups" :key="backup.id">
            <TableCell>{{ backup.name }}</TableCell>
            <TableCell class="text-right tabular-nums">{{
              formatBytes(backup.size)
            }}</TableCell>
            <TableCell>{{
              new Date(backup.created_at).toLocaleString()
            }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Empty v-if="backups.length === 0">
        <p class="text-muted-foreground">
          {{ $t("pages.database.backups.no_backups") }}
        </p>
      </Empty>
    </Card>
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
import { generateSubscription } from "~/graphql/graphqlGen";
import formatBytes from "~/utilities/formatBytes";

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
  },
  inject: ["pollInterval", "refreshTrigger"],
  data() {
    return {
      backups: [] as Array<{
        id: string;
        name: string;
        size: number;
        created_at: string;
      }>,
    };
  },
  methods: {
    formatBytes,
  },
  apollo: {
    $subscribe: {
      backups: {
        query: generateSubscription({
          db_backups: [
            {},
            {
              id: true,
              name: true,
              size: true,
              created_at: true,
            },
          ],
        }),
        result: function ({
          data,
        }: {
          data: {
            db_backups: Array<{
              id: string;
              name: string;
              size: number;
              created_at: string;
            }>;
          };
        }) {
          this.backups = data.db_backups;
        },
      },
    },
  },
  watch: {
    refreshTrigger() {
      // Refetch when manual refresh is triggered
      if (this.$apollo.queries.backups) {
        this.$apollo.queries.backups.refetch();
      }
    },
  },
};
</script>
