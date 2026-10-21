<script setup lang="ts">
import { Zap } from "lucide-vue-next";
import MatchDockLabel from "~/components/match/MatchDockLabel.vue";
import { useVetoOverride } from "~/composables/useVetoOverride";

// The veto step's main action in the admin dock: while it is on, the veto
// board takes the organizer's choice for whichever team is up.
const props = defineProps<{
  matchId: string;
  compact?: boolean;
}>();

const { enabled } = useVetoOverride(() => props.matchId);
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] transition-colors duration-200 ease-out"
    :class="
      enabled
        ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.24)]'
        : 'border-border bg-background/60 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.4)] hover:text-foreground'
    "
    :aria-pressed="enabled"
    @click="enabled = !enabled"
  >
    <MatchDockLabel
      :label="$t('match.admin_bar.veto_override')"
      :compact="compact"
    >
      <Zap class="h-3 w-3 shrink-0" />
    </MatchDockLabel>
  </button>
</template>
