<script setup lang="ts">
/**
 * A closed set of short choices, shown open. A <Select> hides four words behind
 * a popover and a round trip; in an authoring panel that is also teaching a
 * player what the options are, the options have to be readable without opening
 * anything. Wraps rather than scrolls, so nothing is stranded off the edge of a
 * 400px column.
 */
withDefaults(
  defineProps<{
    options: Array<{ key: string; label: string }>;
    /** Equal columns when the set is short enough to make a real segment bar. */
    even?: boolean;
    /** While a choice is being saved, so the set cannot be clicked twice. */
    disabled?: boolean;
  }>(),
  { even: false, disabled: false },
);

const model = defineModel<string>({ required: true });
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <button
      v-for="option of options"
      :key="option.key"
      type="button"
      :disabled="disabled"
      class="rounded border px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      :class="[
        even ? 'min-w-0 flex-1' : '',
        model === option.key
          ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
          : 'border-border text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.35)] hover:text-foreground',
      ]"
      @click="model = option.key"
    >
      {{ option.label }}
    </button>
  </div>
</template>
