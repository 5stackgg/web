<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import formatBytes from "~/utilities/formatBytes";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <div>
      <h1 class="text-xl font-semibold mb-4">DB Backups</h1>
      <AnimatedCard variant="gradient">
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
      </AnimatedCard>
    </div>
  </PageTransition>
</template>

<script lang="ts">
import { generateSubscription } from "~/graphql/graphqlGen";
export default {
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
};
</script>
