<script setup lang="ts">
/**
 * The upvote, drawn as the toggle it is: outlined until you press it, amber
 * with a filled arrow once you have. The count rides beside the arrow.
 */
import { ArrowBigUp } from "lucide-vue-next";
import { Button } from "~/components/ui/button";

withDefaults(
  defineProps<{
    count: number;
    pressed: boolean;
    disabled?: boolean;
    size?: "sm" | "md";
  }>(),
  {
    disabled: false,
    size: "sm",
  },
);

const emit = defineEmits<{
  (e: "toggle"): void;
}>();
</script>

<template>
  <Button
    variant="outline"
    :size="size === 'md' ? 'sm' : 'xs'"
    data-upvote
    :aria-pressed="pressed"
    :disabled="disabled"
    :title="
      pressed ? $t('pages.utility.card.unvote') : $t('pages.utility.card.upvote')
    "
    class="group/upvote shrink-0 gap-1.5 font-mono font-bold tabular-nums transition-[color,background-color,border-color,transform] duration-150 active:scale-95 disabled:opacity-60"
    :class="[
      size === 'md' ? 'h-8 px-2.5 text-xs' : 'h-7 px-2 text-[0.7rem]',
      pressed
        ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.16)] hover:text-[hsl(var(--tac-amber))]'
        : 'text-muted-foreground',
    ]"
    @click.stop="emit('toggle')"
  >
    <ArrowBigUp
      class="transition-transform duration-150 group-hover/upvote:-translate-y-px"
      :class="pressed ? 'fill-current' : ''"
    />
    {{ count }}
  </Button>
</template>
