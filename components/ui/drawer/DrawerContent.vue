<script lang="ts" setup>
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { useForwardPropsEmits } from "reka-ui"
import { DrawerContent, DrawerPortal } from "vaul-vue"
import { cn } from "@/lib/utils"
import DrawerOverlay from "./DrawerOverlay.vue"

// The root here is a portal, which has nowhere to put an attribute: what is
// passed to the content (a style, a data attribute, a role) goes on the
// drawer itself.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    DialogContentProps & {
      class?: HTMLAttributes["class"]
      /** Off for a drawer that is part of the page: nothing behind it dims. */
      overlay?: boolean
      /** Off for a drawer that brings its own grab handle. */
      handle?: boolean
    }
  >(),
  { overlay: true, handle: true },
)
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class", "overlay", "handle")
const forwardedProps = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay v-if="overlay" />
    <DrawerContent
      v-bind="{ ...forwardedProps, ...$attrs }" :class="cn(
        'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background',
        props.class,
      )"
    >
      <div v-if="handle" class="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      <slot />
    </DrawerContent>
  </DrawerPortal>
</template>
