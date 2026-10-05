<template>
  <!-- Two teams, so two buttons instead of a dropdown; the current winner is
       marked so the change being made is visible. -->
  <div
    class="grid grid-cols-2 gap-2"
    role="radiogroup"
    :aria-label="$t('match.winner.set')"
  >
    <button
      v-for="lineup in availableLineups"
      :key="lineup.value"
      type="button"
      role="radio"
      :aria-checked="picked === lineup.value"
      class="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-200 ease-out"
      :class="
        picked === lineup.value
          ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-foreground'
          : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
      "
      @click="pick(lineup.value)"
    >
      <span class="truncate">{{ lineup.display }}</span>
      <span
        v-if="lineup.value === match.winning_lineup_id"
        class="shrink-0 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        {{ $t("match.admin_bar.current") }}
      </span>
    </button>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  // The parent's dialog sets the winner; this only reports the pick.
  emits: ["select"],
  data() {
    return {
      picked: null as string | null,
    };
  },
  watch: {
    // Only a real winner change resets the pick; the match object itself is
    // replaced on every live update.
    "match.winning_lineup_id": {
      immediate: true,
      handler(winningLineupId) {
        this.picked = winningLineupId;
      },
    },
  },
  methods: {
    pick(value: string) {
      this.picked = value;
      const lineup = this.availableLineups.find(
        (lineup) => lineup.value === value,
      );
      this.$emit("select", { value, label: lineup?.display ?? value });
    },
  },
  computed: {
    availableLineups() {
      return [
        {
          value: this.match.lineup_1.id,
          display: this.match.lineup_1.name,
        },
        {
          value: this.match.lineup_2.id,
          display: this.match.lineup_2.name,
        },
      ];
    },
  },
};
</script>
