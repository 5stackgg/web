<script setup lang="ts">
import { computed } from "vue";
import { utilityThrowButtonsKey } from "~/utilities/utilityDisplay";
import type { UtilityThrowStrength } from "~/types/utility";

type UtilityThrowButtons = "left" | "right" | "both" | "middle";

// Which mouse buttons a throw is, as a picture: amber is pressed. Sized by the
// class it is given. `buttons` names them outright -- the wheel, for a throw
// bound to mouse 3, is one no strength maps to.
const props = withDefaults(
  defineProps<{
    strength?: UtilityThrowStrength | null;
    buttons?: UtilityThrowButtons | null;
    // Given, the glyph is the throw's only description and is read out.
    label?: string | null;
  }>(),
  { strength: null, buttons: null, label: null },
);

const key = computed<UtilityThrowButtons>(
  () => props.buttons ?? utilityThrowButtonsKey(props.strength),
);

const ON = "fill-[hsl(var(--tac-amber))]";
const OFF = "fill-white/[0.08]";
</script>

<template>
  <svg
    viewBox="0 0 18 26"
    :role="label ? 'img' : undefined"
    :aria-label="label ?? undefined"
    :aria-hidden="label ? undefined : 'true'"
    :data-buttons="key"
  >
    <path
      d="M1 9a8 8 0 0 1 8-8v10H1z"
      data-part="left"
      :class="key === 'left' || key === 'both' ? ON : OFF"
    />
    <path
      d="M17 9a8 8 0 0 0-8-8v10h8z"
      data-part="right"
      :class="key === 'right' || key === 'both' ? ON : OFF"
    />
    <path
      d="M9 1a8 8 0 0 0-8 8v8a8 8 0 0 0 16 0V9a8 8 0 0 0-8-8zm0 0v10M1 11h16"
      fill="none"
      data-part="shell"
      class="stroke-zinc-500"
      stroke-width="1.25"
    />
    <rect
      x="7.6"
      y="3.2"
      width="2.8"
      height="5.6"
      rx="1.4"
      data-part="wheel"
      :class="key === 'middle' ? ON : 'fill-zinc-700'"
    />
  </svg>
</template>
