<script setup lang="ts">
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// The section tick and label without the section's hairline, for labelled
// groups that sit side by side.
defineProps<{ label: string }>();
</script>

<template>
  <div :class="[tacticalSectionLabelClasses, 'mb-0']">
    <span :class="tacticalSectionTickClasses"></span>
    {{ label }}
  </div>
</template>
