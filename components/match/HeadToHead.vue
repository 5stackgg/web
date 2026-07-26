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
  <!-- The roster pickers come straight off `match`, so the matrix always
       renders and only its stats card crossfades in — swapping the whole tab
       between a loading line and the matrix reflowed the page by ~700px. -->
  <HeadToHeadMatrix
    :match="match"
    :pairs="pairs || []"
    :loading="loading && !pairs"
    v-model:selected-a="selectedA"
    v-model:selected-b="selectedB"
  />
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
