<script lang="ts" setup>
defineProps<{ title?: string }>();
</script>

<template>
  <div class="tac-form-section">
    <div
      v-if="title || $slots.title || $slots.actions"
      class="tac-form-section__head"
      :class="{ 'tac-form-section__head--spread': $slots.actions }"
    >
      <span class="tac-form-section__tick"></span>
      <slot name="title">{{ title }}</slot>
      <div v-if="$slots.actions" class="tac-form-section__actions">
        <slot name="actions" />
      </div>
    </div>
    <div :class="title || $slots.title || $slots.actions ? 'mt-4' : ''">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* A section is just a dash header + its fields — no card/box wrapper, in line
   with the rest of the app. */
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

/* When actions are present the head spans full width so they sit on the far
   right, on the same row as the title. */
.tac-form-section__head--spread {
  display: flex;
  width: 100%;
}

.tac-form-section__actions {
  margin-left: auto;
  /* reset the head's uppercase/tracking so action labels render normally */
  text-transform: none;
  letter-spacing: normal;
}
</style>
