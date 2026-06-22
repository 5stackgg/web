<script setup lang="ts">
import type { Component } from "vue";

defineProps<{
  label: string;
  description?: string;
  icon?: Component;
  active?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    class="tsc group/tsc relative isolate flex min-h-[92px] flex-col gap-[0.4rem] overflow-hidden border border-border px-4 pb-4 pt-3.5 text-left [transition:border-color_180ms_ease,background_220ms_ease,box-shadow_220ms_ease]"
    :class="active ? 'tsc-active' : ''"
  >
    <span class="corner corner-tl" aria-hidden="true"></span>
    <span class="corner corner-br" aria-hidden="true"></span>
    <span class="scanline" aria-hidden="true"></span>

    <div
      class="relative z-[1] inline-flex items-center gap-[0.55rem] font-mono text-[0.72rem] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors [transition-duration:180ms] group-hover/tsc:text-[hsl(var(--tac-amber))]"
      :class="{ '!text-[hsl(var(--tac-amber))]': active }"
    >
      <component :is="icon" v-if="icon" class="h-4 w-4" />
      <span
        v-else
        class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
        aria-hidden="true"
      ></span>
      {{ label }}
    </div>

    <p
      v-if="description"
      class="relative z-[1] m-0 text-[0.76rem] leading-[1.45] text-muted-foreground"
    >
      {{ description }}
    </p>
  </button>
</template>

<style scoped>
.tsc {
  background: linear-gradient(
    135deg,
    hsl(var(--card) / 0.7) 0%,
    hsl(var(--card) / 0.35) 60%,
    hsl(var(--tac-amber) / 0.05) 100%
  );
}
.tsc:hover {
  border-color: hsl(var(--tac-amber) / 0.55);
  box-shadow: 0 0 24px hsl(var(--tac-amber) / 0.12);
}
.tsc:focus-visible {
  outline: none;
  border-color: hsl(var(--tac-amber));
  box-shadow: 0 0 0 2px hsl(var(--tac-amber) / 0.35);
}
.tsc-active {
  border-color: hsl(var(--tac-amber)) !important;
  background: linear-gradient(
    135deg,
    hsl(var(--card) / 0.8) 0%,
    hsl(var(--tac-amber) / 0.18) 100%
  );
  box-shadow: 0 0 32px hsl(var(--tac-amber) / 0.2);
}
.corner {
  position: absolute;
  width: 13px;
  height: 13px;
  pointer-events: none;
  z-index: 2;
  border: 0 solid hsl(var(--tac-amber));
  opacity: 0;
  transition: opacity 180ms ease;
}
.corner-tl {
  top: 7px;
  left: 7px;
  border-top-width: 2px;
  border-left-width: 2px;
}
.corner-br {
  bottom: 7px;
  right: 7px;
  border-bottom-width: 2px;
  border-right-width: 2px;
}
.tsc:hover .corner,
.tsc-active .corner {
  opacity: 1;
}
.scanline {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 220ms ease;
  background-image: repeating-linear-gradient(
    180deg,
    transparent 0,
    transparent 3px,
    hsl(var(--tac-amber) / 0.03) 3px,
    hsl(var(--tac-amber) / 0.03) 4px
  );
}
.tsc:hover .scanline,
.tsc-active .scanline {
  opacity: 1;
}
</style>
