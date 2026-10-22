<script setup lang="ts">
import type { TabsListProps } from "reka-ui"
import type { ComponentPublicInstance, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TabsList } from "reka-ui"
import { computed, nextTick, onMounted, onUnmounted, provide, ref, toRef } from "vue"
import { cn } from "@/lib/utils"
import { type TabsListVariant, tabsListVariantKey } from "."

const props = withDefaults(
  defineProps<
    TabsListProps & {
      class?: HTMLAttributes["class"]
      variant?: TabsListVariant
    }
  >(),
  { variant: "default" },
)

const delegatedProps = reactiveOmit(props, "class", "variant")
provide(tabsListVariantKey, toRef(props, "variant"))
const listRef = ref<ComponentPublicInstance | HTMLElement | null>(null)
const indicatorX = ref(0)
const indicatorY = ref(0)
const indicatorWidth = ref(0)
const indicatorHeight = ref(0)
const hasAnimated = ref(false)
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryCount = 0
const MAX_MEASURE_RETRIES = 8

function getListElement(): HTMLElement | null {
  const target = listRef.value

  if (!target) return null
  if (target instanceof HTMLElement) return target

  return target.$el instanceof HTMLElement ? target.$el : null
}

function updateIndicator() {
  const listElement = getListElement()

  if (!listElement) return

  const activeTrigger = listElement.querySelector(
    '[data-state="active"]',
  ) as HTMLElement | null

  if (!activeTrigger) {
    indicatorWidth.value = 0
    hasAnimated.value = false
    scheduleRetry()
    return
  }

  const listRect = listElement.getBoundingClientRect()
  const activeRect = activeTrigger.getBoundingClientRect()

  // Track the active trigger's full box, not just its horizontal span: a
  // wrapping list (e.g. the stage builder) puts triggers on several rows, and a
  // top-to-bottom indicator would highlight the whole column instead of one tab.
  // The indicator is placed inside the list's padding box, so a bordered list
  // (track) takes its border off.
  indicatorX.value =
    activeRect.left - listRect.left - listElement.clientLeft + listElement.scrollLeft
  indicatorY.value =
    activeRect.top - listRect.top - listElement.clientTop + listElement.scrollTop
  indicatorWidth.value = activeRect.width
  indicatorHeight.value = activeRect.height

  nextTick(() => {
    hasAnimated.value = true
  })

  // If layout is still settling (e.g. enter transitions), try again shortly.
  if (activeRect.width === 0) {
    scheduleRetry()
  } else {
    clearRetry()
  }
}

let observer: MutationObserver | null = null
let resizeObserver: ResizeObserver | null = null

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  retryCount = 0
}

function scheduleRetry() {
  if (retryTimer || retryCount >= MAX_MEASURE_RETRIES) {
    return
  }

  retryCount += 1
  retryTimer = setTimeout(() => {
    retryTimer = null
    updateIndicator()
  }, 80)
}

onMounted(() => {
  nextTick(() => {
    updateIndicator()

    const listElement = getListElement()

    if (!listElement) return

    observer = new MutationObserver(updateIndicator)
    observer.observe(listElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["data-state"],
    })
    // Triggers that share the list's width move when the list resizes without
    // the window doing so (a sidebar opening, a row wrapping).
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateIndicator)
      resizeObserver.observe(listElement)
    }

    // Some tabs initialize active state after the first paint.
    // Re-run on subsequent frames so the indicator appears immediately.
    requestAnimationFrame(() => {
      updateIndicator()
      requestAnimationFrame(updateIndicator)
    })
    window.addEventListener("resize", updateIndicator)
  })
})

onUnmounted(() => {
  clearRetry()
  observer?.disconnect()
  resizeObserver?.disconnect()
  window.removeEventListener("resize", updateIndicator)
})

const showIndicator = computed(() => indicatorWidth.value > 0)
</script>

<template>
  <TabsList
    ref="listRef"
    v-bind="delegatedProps"
    :class="cn(
      'relative inline-flex items-center justify-center text-muted-foreground',
      props.variant === 'default' && 'rounded-lg bg-muted p-1',
      props.variant === 'underline' && 'gap-1 bg-transparent p-0',
      props.variant === 'track' && 'grid w-full grid-cols-4 gap-0.5 rounded-lg border border-border bg-muted/30 p-1 md:flex md:flex-wrap',
      props.class,
    )"
  >
    <div
      v-if="props.variant === 'default'"
      v-show="showIndicator"
      class="pointer-events-none absolute left-0 top-0 z-0 rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] shadow-[0_0_12px_hsl(var(--tac-amber)/0.25)]"
      :class="
        hasAnimated
          ? '[transition:transform_0.35s_cubic-bezier(0.34,1.56,0.64,1),width_0.2s_ease,height_0.2s_ease]'
          : ''
      "
      :style="{
        transform: `translate(${indicatorX}px, ${indicatorY}px)`,
        width: `${indicatorWidth}px`,
        height: `${indicatorHeight}px`,
      }"
    />
    <div
      v-if="props.variant === 'track'"
      v-show="showIndicator"
      class="pointer-events-none absolute left-0 top-0 z-0 rounded-md bg-[hsl(var(--tac-amber)/0.12)] ring-1 ring-inset ring-[hsl(var(--tac-amber)/0.4)]"
      :class="
        hasAnimated
          ? '[transition:transform_0.35s_cubic-bezier(0.34,1.56,0.64,1),width_0.2s_ease,height_0.2s_ease]'
          : ''
      "
      :style="{
        transform: `translate(${indicatorX}px, ${indicatorY}px)`,
        width: `${indicatorWidth}px`,
        height: `${indicatorHeight}px`,
      }"
    />
    <div
      v-if="props.variant === 'underline'"
      v-show="showIndicator"
      class="pointer-events-none absolute left-0 top-0 z-0 h-0.5 rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_8px_hsl(var(--tac-amber)/0.45)]"
      :class="
        hasAnimated
          ? '[transition:transform_0.35s_cubic-bezier(0.34,1.56,0.64,1),width_0.2s_ease]'
          : ''
      "
      :style="{
        transform: `translate(${indicatorX}px, ${indicatorY + indicatorHeight - 2}px)`,
        width: `${indicatorWidth}px`,
      }"
    />
    <slot />
  </TabsList>
</template>
