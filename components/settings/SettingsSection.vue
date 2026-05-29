<script setup lang="ts">
import { Card } from "~/components/ui/card";

defineProps<{
  id: string;
  title: string;
  description?: string;
  /** When true, clicking anywhere on the header emits `header-click` (use to toggle a header switch). */
  clickableHeader?: boolean;
}>();

defineEmits<{
  (e: "header-click"): void;
}>();
</script>

<template>
  <section :id="id" class="scroll-mt-4">
    <Card variant="gradient">
      <div class="p-6 space-y-6">
        <div
          class="flex items-start gap-3"
          :class="clickableHeader ? 'cursor-pointer select-none' : ''"
          @click="clickableHeader && $emit('header-click')"
        >
          <span
            class="w-0.5 self-stretch rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_8px_hsl(var(--tac-amber)/0.45)]"
          />
          <div class="min-w-0 flex-1 space-y-0.5">
            <h3
              class="text-sm font-semibold uppercase tracking-wider text-foreground"
            >
              {{ title }}
            </h3>
            <p v-if="description" class="text-sm text-muted-foreground">
              {{ description }}
            </p>
          </div>
          <div v-if="$slots.action" class="shrink-0 pl-4 pt-0.5" @click.stop>
            <slot name="action" />
          </div>
        </div>

        <div v-if="$slots.default" class="space-y-6">
          <slot />
        </div>
      </div>
    </Card>
  </section>
</template>
