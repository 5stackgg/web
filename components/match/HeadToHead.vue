<script lang="ts" setup>
import HeadToHeadMatrix from "~/components/match/HeadToHeadMatrix.vue";

// All props are declared here (not in the Options block below) — mixing a
// setup prop macro with an Options `props` block clobbers the latter, which
// left `this.match` undefined in the apollo variables().
defineProps<{ match: any }>();

// Mirror the matrix's picked players up to the tab so the radar comparison
// below can follow the same matchup.
const selectedA = defineModel<string | null>("selectedA", { default: null });
const selectedB = defineModel<string | null>("selectedB", { default: null });
</script>

<template>
  <div>
    <div
      v-if="loading && !pairs"
      class="py-8 text-center font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground"
    >
      {{ $t("common.loading") }}…
    </div>
    <HeadToHeadMatrix
      v-else
      :match="match"
      :pairs="pairs || []"
      v-model:selected-a="selectedA"
      v-model:selected-b="selectedB"
    />
  </div>
</template>

<script lang="ts">
import { headToHeadQuery } from "~/graphql/headToHeadGraphql";

export default {
  data() {
    return {
      pairs: null as null | any[],
    };
  },
  apollo: {
    pairs: {
      query: headToHeadQuery,
      variables() {
        return { matchId: this.match.id };
      },
      update(data: any) {
        return data?.v_player_match_head_to_head ?? [];
      },
    },
  },
  computed: {
    loading(): boolean {
      const q: any = (this.$apollo as any)?.queries?.pairs;
      return !!q?.loading;
    },
  },
};
</script>
