<template>
  <SectionEmpty
    v-if="loaded && backups.length === 0"
    :title="$t('pages.database.explorer.no_backups_title')"
    :description="$t('pages.database.explorer.no_backups_hint')"
  />
  <DbGrid
    v-else-if="backups.length"
    v-model:sort="sort"
    v-model:dir="dir"
    :rows="backups"
    :columns="columns"
    :row-key="(r) => r.id"
  >
    <template #cell-name="{ row }">
      <span class="font-mono text-[11.5px]">{{ row.name }}</span>
    </template>
    <template #cell-size="{ row }">{{ formatSize(row.size) }}</template>
    <template #cell-created_at="{ row }">
      {{ new Date(row.created_at).toLocaleString(dateLocale()) }}
      <span class="text-muted-foreground/70">
        · <TimeAgo :date="row.created_at" hide-icon
      /></span>
    </template>
  </DbGrid>
</template>

<script lang="ts">
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import DbGrid from "./DbGrid.vue";
import { generateSubscription } from "~/graphql/graphqlGen";
import { dateLocale } from "~/utilities/dateLocale";
import { formatSize, type DbGridColumn } from "./dbHealth";

type Backup = { id: string; name: string; size: number; created_at: string };

export default {
  components: { SectionEmpty, TimeAgo, DbGrid },
  data() {
    return {
      backups: [] as Backup[],
      loaded: false,
      sort: "created_at",
      dir: "desc" as "asc" | "desc",
    };
  },
  computed: {
    columns(): DbGridColumn[] {
      return [
        { key: "name", label: this.$t("common.name") },
        {
          key: "size",
          label: this.$t("pages.settings.application.db_backups.size"),
          num: true,
        },
        {
          key: "created_at",
          label: this.$t("pages.settings.application.db_backups.created_at"),
          value: (r: Backup) => Date.parse(r.created_at),
        },
      ];
    },
  },
  methods: {
    formatSize,
    dateLocale,
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
        result({ data }: { data: { db_backups: Backup[] } }) {
          this.backups = data.db_backups;
          this.loaded = true;
        },
      },
    },
  },
};
</script>
