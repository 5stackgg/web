<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { useI18n } from "vue-i18n";

defineProps<{
  canLeft?: boolean;
  canRight?: boolean;
}>();

defineEmits<{
  (e: "scroll", direction: "left" | "right"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div v-show="canLeft || canRight" class="inline-flex items-center gap-1">
    <button
      type="button"
      :aria-label="t('ui.scroll.left')"
      :disabled="!canLeft"
      class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-background/60 text-foreground/80 transition-[opacity,color,background-color,border-color] duration-150 hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-background hover:text-[hsl(var(--tac-amber))] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border/70 disabled:hover:bg-background/60 disabled:hover:text-foreground/80"
      @click="$emit('scroll', 'left')"
    >
      <ChevronLeft class="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      :aria-label="t('ui.scroll.right')"
      :disabled="!canRight"
      class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-background/60 text-foreground/80 transition-[opacity,color,background-color,border-color] duration-150 hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-background hover:text-[hsl(var(--tac-amber))] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border/70 disabled:hover:bg-background/60 disabled:hover:text-foreground/80"
      @click="$emit('scroll', 'right')"
    >
      <ChevronRight class="h-3.5 w-3.5" />
    </button>
  </div>
</template>
