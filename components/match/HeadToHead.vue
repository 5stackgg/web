<script lang="ts" setup>
import HeadToHeadMatrix from "~/components/match/HeadToHeadMatrix.vue";
</script>

<template>
  <div>
    <div
      v-if="loading && !pairs"
      class="py-8 text-center font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground"
    >
      {{ $t("common.loading") }}…
    </div>
    <HeadToHeadMatrix v-else :match="match" :pairs="pairs || []" />
  </div>
</template>

<script lang="ts">
import { headToHeadQuery } from "~/graphql/headToHeadGraphql";

export default {
  props: {
    match: {
      required: true,
      type: Object,
    },
  },
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
