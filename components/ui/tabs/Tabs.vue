<script setup lang="ts">
import type { TabsRootEmits, TabsRootProps } from "reka-ui"
import { TabsRoot, useForwardProps } from "reka-ui"
import { reactiveOmit } from "@vueuse/core"
import { watch } from "vue"
import { useScrollFloor } from "~/composables/useScrollFloor"

// scrollFloor: reserve page height on tab change so a shorter tab can't yank
// the view up when the user is scrolled down. On by default — opt out for tab
// strips that don't swap page content (dialogs, sidebar panels, segmented form
// controls), which would reserve height for nothing.
const props = withDefaults(
  defineProps<TabsRootProps & { scrollFloor?: boolean }>(),
  { scrollFloor: true },
)
const emits = defineEmits<TabsRootEmits>()

const delegatedProps = reactiveOmit(props, "scrollFloor")
const forwarded = useForwardProps(delegatedProps)

const { capture } = useScrollFloor()

function captureFloor() {
  if (props.scrollFloor) {
    capture()
  }
}

// Both directions matter: the emit covers trigger clicks and uncontrolled
// roots, the watch covers controlled parents that set the tab from outside the
// strip (mobile <Select> mirrors, ?tab= deep links).
function onUpdateModelValue(value: string | number) {
  captureFloor()
  emits("update:modelValue", value)
}
watch(() => props.modelValue, captureFloor)
</script>

<template>
  <TabsRoot v-bind="forwarded" @update:model-value="onUpdateModelValue">
    <slot />
  </TabsRoot>
</template>
