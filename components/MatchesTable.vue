<script setup lang="ts">
import MatchTableRow from "~/components/MatchTableRow.vue";
</script>

<template>
  <div class="space-y-4">
    <template v-if="matches.length === 0">
      <div class="text-center py-12">
        <div class="text-gray-500 dark:text-gray-400">
          <p>
            <slot name="none-found">{{
              $t("match.options.table.no_matches_found")
            }}</slot>
          </p>
        </div>
      </div>
    </template>
    <template v-else>
      <MatchTableRow
        v-for="match of matches"
        :key="match.id"
        :match="match"
        :player="player"
      />
    </template>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    matches: {
      type: Array,
      required: true,
    },
    player: {
      type: Object,
      required: false,
      default: null,
    },
  },
};
</script>
