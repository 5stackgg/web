<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  fade?: boolean
  fadeSize?: number
}>(), {
  fade: true,
  fadeSize: 36,
})

const scrollEl = ref<HTMLElement | null>(null)
const topFade = ref(0)
const bottomFade = ref(0)

function measure() {
  const el = scrollEl.value
  if (!el)
    return
  const max = el.scrollHeight - el.clientHeight
  if (max <= 1) {
    topFade.value = 0
    bottomFade.value = 0
    return
  }
  const offset = Math.max(0, Math.min(el.scrollTop, max))
  topFade.value = Math.min(props.fadeSize, offset)
  bottomFade.value = Math.min(props.fadeSize, max - offset)
}

// Scrollbars are hidden app-wide, so the only affordance telling you there is
// more nav below the fold is this fade. It only appears on the edge that has
// content beyond it, and shrinks as you reach either end.
const maskStyle = computed(() => {
  if (!props.fade || (topFade.value < 1 && bottomFade.value < 1))
    return undefined
  const mask = `linear-gradient(to bottom, transparent 0px, #000 ${topFade.value}px, #000 calc(100% - ${bottomFade.value}px), transparent 100%)`
  return { maskImage: mask, WebkitMaskImage: mask }
})

let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null

function observeChildren(el: HTMLElement) {
  for (const child of Array.from(el.children))
    resizeObserver?.observe(child)
}

onMounted(() => {
  const el = scrollEl.value
  if (!el)
    return

  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(el)
  observeChildren(el)

  mutationObserver = new MutationObserver(() => {
    observeChildren(el)
    measure()
  })
  mutationObserver.observe(el, { childList: true, subtree: true, characterData: true })

  measure()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
})
</script>

<template>
  <div
    ref="scrollEl"
    data-sidebar="content"
    :style="maskStyle"
    :class="cn('flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-contain', props.class)"
    @scroll.passive="measure"
    @transitionend="measure"
  >
    <slot />
  </div>
</template>
