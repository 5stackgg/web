<script lang="ts" setup>
defineProps<{ title?: string }>();
</script>

<template>
  <div class="tac-form-section">
    <div v-if="title || $slots.title" class="tac-form-section__head">
      <span class="tac-form-section__tick"></span>
      <slot name="title">{{ title }}</slot>
    </div>
    <div :class="title || $slots.title ? 'mt-5' : ''">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.tac-form-section {
  position: relative;
  border-radius: var(--radius);
  border: 1px solid hsl(var(--border));
  padding: 1.25rem;
  background: linear-gradient(
    180deg,
    hsl(var(--card) / 0.55) 0%,
    hsl(var(--card) / 0.25) 100%
  );
  backdrop-filter: blur(6px);
}

.tac-form-section::before,
.tac-form-section::after {
  content: "";
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
}

.tac-form-section::before {
  left: 0.5rem;
  top: 0.5rem;
  border-left: 2px solid hsl(var(--tac-amber));
  border-top: 2px solid hsl(var(--tac-amber));
}

.tac-form-section::after {
  right: 0.5rem;
  bottom: 0.5rem;
  border-right: 2px solid hsl(var(--tac-amber));
  border-bottom: 2px solid hsl(var(--tac-amber));
}

.tac-form-section__head {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: hsl(var(--muted-foreground));
}

.tac-form-section__tick {
  height: 2px;
  width: 10px;
  background: hsl(var(--tac-amber));
}
</style>
