<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, Cpu } from "lucide-vue-next";

const props = defineProps<{
  picks: Array<any>;
}>();

const entries = computed(() => {
  return [...(props.picks || [])].reverse();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-2 flex items-center gap-2">
      <span class="log-tick"></span>
      <h3
        class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
      >
        {{ $t("draft_games.room.draft_log") }}
      </h3>
    </div>

    <div class="draft-log-scroll flex-1 space-y-1 overflow-y-auto pr-1">
      <TransitionGroup name="log">
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="log-row flex items-center gap-2 rounded border border-border/60 bg-card/40 px-2.5 py-1.5 text-xs"
          :class="
            entry.lineup === 1 ? 'log-row-amber' : 'log-row-blue'
          "
        >
          <ChevronRight class="h-3 w-3 shrink-0 text-muted-foreground/60" />
          <span class="truncate text-muted-foreground">
            <span class="font-semibold text-foreground/90">{{
              entry.captain?.name
            }}</span>
            {{ $t("draft_games.room.log_picked") }}
            <span class="font-semibold text-foreground">{{
              entry.picked?.name
            }}</span>
          </span>
          <Cpu
            v-if="entry.auto_picked"
            class="h-3 w-3 shrink-0 text-muted-foreground/50"
          />
          <span
            class="ml-auto shrink-0 font-mono text-[0.6rem] uppercase tracking-wider team-tag"
          >
            {{ entry.lineup === 1 ? "1" : "2" }}
          </span>
        </div>
      </TransitionGroup>
      <div
        v-if="entries.length === 0"
        class="py-6 text-center text-xs text-muted-foreground/50"
      >
        {{ $t("draft_games.room.log_empty") }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-tick {
  display: inline-block;
  height: 2px;
  width: 10px;
  background: hsl(var(--tac-amber));
}
.log-row-amber {
  border-left: 2px solid hsl(var(--tac-amber) / 0.6);
}
.log-row-blue {
  border-left: 2px solid hsl(200 90% 62% / 0.6);
}
.log-row-amber .team-tag {
  color: hsl(var(--tac-amber));
}
.log-row-blue .team-tag {
  color: hsl(200 90% 62%);
}
.draft-log-scroll {
  max-height: 220px;
}
.log-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.log-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
