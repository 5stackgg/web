<script setup lang="ts">
import { TriangleAlert } from "lucide-vue-next";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

// A menu action that can't run right now. Not `disabled`: a disabled item is
// skipped by arrow keys and gets no pointer events, so its reasons could
// only ever be hovered. It stays announced as unavailable, and the tooltip
// opens on hover or keyboard focus.
defineProps<{ reasons: Array<string> }>();

// reka's MenuItem binds aria-disabled from its own `disabled` prop after
// $attrs, so a passed aria-disabled never reaches the element.
const vAriaDisabled = {
  mounted: (el: HTMLElement) => el.setAttribute("aria-disabled", "true"),
};
</script>

<template>
  <FiveStackToolTip as-child :delay-duration="120">
    <template #trigger>
      <DropdownMenuItem
        v-aria-disabled
        class="cursor-default"
        @select.prevent
      >
        <span
          class="flex min-w-0 flex-1 items-center gap-2 opacity-50 [&>svg]:size-4 [&>svg]:shrink-0"
        >
          <slot />
        </span>
        <span
          class="inline-flex text-[hsl(var(--tac-amber))]"
          role="img"
          :aria-label="reasons.join(' ')"
        >
          <TriangleAlert class="!size-3.5" />
        </span>
      </DropdownMenuItem>
    </template>
    <div class="max-w-[16rem] space-y-1.5">
      <p v-for="reason in reasons" :key="reason">{{ reason }}</p>
    </div>
  </FiveStackToolTip>
</template>
