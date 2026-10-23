<script setup lang="ts">
import { Pause, Play } from "lucide-vue-next";
import { Button } from "~/components/ui/button";

// The header's pause control while a map is played.
defineProps<{
  show: boolean;
  paused: boolean;
  loading?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <!-- The pause control appears when a map goes live; its column animates
       0fr -> 1fr so the kebab slides over instead of jumping. Both labels
       are always laid out (one invisible), so Pause <-> Resume never
       changes the button's width -- only the colors cross-fade. -->
  <Transition
    enter-active-class="pause-reveal"
    enter-from-class="pause-reveal-collapsed"
    leave-active-class="pause-reveal"
    leave-to-class="pause-reveal-collapsed"
  >
    <div v-if="show" class="grid min-w-0 grid-cols-[1fr]">
      <div class="min-w-0 overflow-hidden">
        <Button
          size="sm"
          variant="outline"
          :loading="loading"
          :disabled="disabled"
          :class="[
            'h-9 gap-1.5 font-mono text-[0.62rem] font-bold tracking-[0.18em] uppercase transition-colors',
            paused
              ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] hover:text-[hsl(var(--tac-amber))]'
              : 'border-[hsl(var(--destructive)/0.55)] bg-[hsl(var(--destructive)/0.12)] text-destructive hover:bg-[hsl(var(--destructive)/0.2)] hover:text-destructive',
          ]"
          @click="emit('toggle')"
        >
          <component :is="paused ? Play : Pause" class="h-3 w-3" />
          <span class="grid text-center">
            <span
              class="col-start-1 row-start-1"
              :class="{ invisible: paused }"
              :aria-hidden="paused"
            >
              {{ $t("match.actions.pause") }}
            </span>
            <span
              class="col-start-1 row-start-1"
              :class="{ invisible: !paused }"
              :aria-hidden="!paused"
            >
              {{ $t("match.actions.resume") }}
            </span>
          </span>
        </Button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* The pause control's column collapses to a true zero -- the cell carries no
   padding of its own, so nothing is left to snap when the element unmounts. */
.pause-reveal {
  transition:
    grid-template-columns 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}
.pause-reveal-collapsed {
  grid-template-columns: 0fr;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .pause-reveal {
    transition-duration: 1ms;
  }
}
</style>
