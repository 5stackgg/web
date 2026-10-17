<script setup lang="ts">
import ManageSection from "~/components/common/ManageSection.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// A report section: hairline above, tick label with its explanation behind an
// info tooltip, no frame. Frames are for the stat cards inside. Jump to
// focuses the section it lands on, so it carries no focus ring.
defineProps<{
  id?: string;
  label?: string;
  hint?: string;
}>();
</script>

<template>
  <ManageSection :id="id" class="outline-none">
    <div v-if="label" class="flex items-center gap-1.5">
      <h2 :class="[tacticalSectionLabelClasses, 'mb-0']">
        <span :class="tacticalSectionTickClasses" />
        {{ label }}
      </h2>
      <FiveStackToolTip v-if="hint" class="text-muted-foreground">
        <span class="block max-w-[20rem]">{{ hint }}</span>
      </FiveStackToolTip>
    </div>
    <slot />
  </ManageSection>
</template>
