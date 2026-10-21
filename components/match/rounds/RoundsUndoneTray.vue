<script setup lang="ts">
import { computed } from "vue";
import { RotateCw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { faqHotClasses } from "~/utilities/faqClasses";

const props = defineProps<{
  rounds: number[];
  liveRound: number;
  canBringBack?: boolean;
  hot?: boolean;
}>();

const emit = defineEmits<{ bringBack: [] }>();

const first = computed(() => props.rounds[0]);
const last = computed(() => props.rounds.at(-1));
</script>

<template>
  <div
    v-if="rounds.length"
    class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2"
  >
    <span
      class="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
    >
      {{ $t("match.rewind.undone") }}
    </span>
    <span class="flex gap-[3px] opacity-50" aria-hidden="true">
      <span
        v-for="round in rounds"
        :key="round"
        class="h-3.5 w-4 rounded-[3px] border border-dashed border-muted-foreground/60"
      />
    </span>
    <span class="text-sm">
      {{
        first === last
          ? $t("match.rewind.undone_one", { round: first })
          : $t("match.rewind.undone_many", { from: first, to: last })
      }}
    </span>
    <span class="text-xs text-muted-foreground">
      {{ $t("match.rewind.undone_until", { round: liveRound }) }}
    </span>
    <span class="flex-1" />
    <Button
      v-if="canBringBack"
      size="sm"
      variant="outline"
      class="h-7 gap-1.5 border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] hover:text-[hsl(var(--tac-amber))] [&_svg]:size-3.5"
      :class="hot && faqHotClasses"
      @click="emit('bringBack')"
    >
      <RotateCw />
      {{ $t("match.rewind.bring_back") }}
    </Button>
  </div>
</template>
