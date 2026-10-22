<script setup lang="ts">
import { cn } from "~/lib/utils";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// A node panel section's name, in the app's tick-and-label style. `mb-0`
// drops the label util's own margin; the section's grid owns the spacing.
// Merged with cn: in a plain class list Tailwind's mb-3 outranks mb-0, which
// left every label 6px above the controls beside it.
</script>

<template>
  <h3 :class="cn(tacticalSectionLabelClasses, 'mb-0 whitespace-nowrap')">
    <span :class="tacticalSectionTickClasses" aria-hidden="true"></span>
    <slot />
  </h3>
</template>
