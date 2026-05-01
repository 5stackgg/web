<script setup lang="ts">
import { Kbd, KbdGroup } from "~/components/ui/kbd";

defineProps<{
  open: boolean;
  groups: Array<{
    title: string;
    items: Array<{ keys: string[]; label: string }>;
  }>;
}>();

defineEmits<{ (e: "close"): void }>();
</script>

<template>
  <Transition name="shortcut-overlay">
    <div
      v-if="open"
      class="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-md bg-background/80"
      @click.self="$emit('close')"
    >
      <div
        class="max-w-3xl w-[min(90%,42rem)] rounded-xl border border-border/70 bg-card/95 shadow-2xl px-8 py-7"
      >
        <div class="flex items-baseline justify-between mb-5">
          <h2
            class="font-mono text-xs uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
          >
            Keyboard shortcuts
          </h2>
          <p
            class="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground"
          >
            <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
          </p>
        </div>

        <div class="grid grid-cols-2 gap-x-8 gap-y-5">
          <section v-for="group in groups" :key="group.title">
            <h3
              class="mb-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/80"
            >
              {{ group.title }}
            </h3>
            <ul class="space-y-1.5">
              <li
                v-for="item in group.items"
                :key="item.label"
                class="flex items-center justify-between gap-3 text-sm"
              >
                <span class="text-foreground/80">{{ item.label }}</span>
                <KbdGroup>
                  <Kbd v-for="(k, i) in item.keys" :key="i">{{ k }}</Kbd>
                </KbdGroup>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.shortcut-overlay-enter-active,
.shortcut-overlay-leave-active {
  transition:
    opacity 200ms ease,
    backdrop-filter 200ms ease;
}
.shortcut-overlay-enter-active > div,
.shortcut-overlay-leave-active > div {
  transition:
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 200ms ease;
}
.shortcut-overlay-enter-from,
.shortcut-overlay-leave-to {
  opacity: 0;
}
.shortcut-overlay-enter-from > div {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}
.shortcut-overlay-leave-to > div {
  opacity: 0;
  transform: scale(0.98);
}
</style>
