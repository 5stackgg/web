<script setup lang="ts">
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// A node panel section's name, in the app's tick-and-label style. `mb-0`
// drops the label util's own margin; the section's grid owns the spacing.
</script>

<template>
  <h3 :class="[tacticalSectionLabelClasses, 'mb-0 whitespace-nowrap']">
    <span :class="tacticalSectionTickClasses" aria-hidden="true"></span>
    <slot />
  </h3>
</template>
