<script setup lang="ts">
import type { ToastViewportProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ToastViewport } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<ToastViewportProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <ToastViewport v-bind="delegatedProps" :class="cn('toast-viewport fixed top-0 z-40 flex max-h-screen w-full flex-col-reverse p-4 sm:top-auto sm:flex-col md:max-w-[420px]', props.class)" />
</template>

<style>
/* Bottom-left of the content column: clear of the right hub, above the admin
   dock and the floating save bar. */
@media (min-width: 640px) {
  .toast-viewport {
    left: var(--main-content-left, 0px);
    bottom: var(--main-bottom-dock-height, 0px);
  }

  body:has(> div > .save-bar) .toast-viewport {
    bottom: calc(var(--main-bottom-dock-height, 0px) + 4.5rem);
  }
}

/* z-40 keeps a toast under menus, popovers and selects (z-50). A modal's dim
   overlay would bury it there, so it rises above the overlay while one is
   mounted. Popovers are role="dialog" too; data-side tells them apart. */
body:has([role="dialog"]:not([data-side]), [role="alertdialog"])
  .toast-viewport {
  z-index: 100;
}
</style>
