<script setup lang="ts">
import { computed } from "vue";
import { utilityThrowButtonsKey } from "~/utilities/utilityDisplay";
import type { UtilityThrowStrength } from "~/types/utility";

// Which mouse buttons a throw is, as a picture: amber is pressed. Sized by the
// class it is given.
const props = defineProps<{
  strength: UtilityThrowStrength | null | undefined;
}>();

const key = computed(() => utilityThrowButtonsKey(props.strength));
</script>

<template>
  <svg viewBox="0 0 18 26" aria-hidden="true">
    <path
      d="M1 9a8 8 0 0 1 8-8v10H1z"
      :class="
        key === 'right' ? 'fill-white/[0.08]' : 'fill-[hsl(var(--tac-amber))]'
      "
    />
    <path
      d="M17 9a8 8 0 0 0-8-8v10h8z"
      :class="
        key === 'left' ? 'fill-white/[0.08]' : 'fill-[hsl(var(--tac-amber))]'
      "
    />
    <path
      d="M9 1a8 8 0 0 0-8 8v8a8 8 0 0 0 16 0V9a8 8 0 0 0-8-8zm0 0v10M1 11h16"
      fill="none"
      class="stroke-zinc-500"
      stroke-width="1.25"
    />
  </svg>
</template>
