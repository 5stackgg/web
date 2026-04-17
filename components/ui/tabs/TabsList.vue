<script setup lang="ts">
import type { TabsListProps } from "reka-ui"
import type { ComponentPublicInstance, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TabsList } from "reka-ui"
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue"
import { cn } from "@/lib/utils"

type TabsListVariant = "default" | "underline"

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
const listRef = ref<ComponentPublicInstance | HTMLElement | null>(null)
const indicatorX = ref(0)
const indicatorWidth = ref(0)
const hasAnimated = ref(false)

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
    return
  }

  const listRect = listElement.getBoundingClientRect()
  const activeRect = activeTrigger.getBoundingClientRect()

  indicatorX.value = activeRect.left - listRect.left
  indicatorWidth.value = activeRect.width

  nextTick(() => {
    hasAnimated.value = true
  })
}

let observer: MutationObserver | null = null

onMounted(() => {
  nextTick(() => {
    updateIndicator()

    const listElement = getListElement()

    if (!listElement) return

    observer = new MutationObserver(updateIndicator)
    observer.observe(listElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state"],
    })
    window.addEventListener("resize", updateIndicator)
  })
})

onUnmounted(() => {
  observer?.disconnect()
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
      props.class,
    )"
  >
    <div
      v-if="props.variant === 'default'"
      v-show="showIndicator"
      class="pointer-events-none absolute bottom-1 left-0 top-1 z-0 rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] shadow-[0_0_12px_hsl(var(--tac-amber)/0.25)]"
      :class="
        hasAnimated
          ? '[transition:transform_0.35s_cubic-bezier(0.34,1.56,0.64,1),width_0.2s_ease]'
          : ''
      "
      :style="{
        transform: `translateX(${indicatorX}px)`,
        width: `${indicatorWidth}px`,
      }"
    />
    <div
      v-if="props.variant === 'underline'"
      v-show="showIndicator"
      class="pointer-events-none absolute bottom-0 left-0 z-0 h-0.5 rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_8px_hsl(var(--tac-amber)/0.45)]"
      :class="
        hasAnimated
          ? '[transition:transform_0.35s_cubic-bezier(0.34,1.56,0.64,1),width_0.2s_ease]'
          : ''
      "
      :style="{
        transform: `translateX(${indicatorX}px)`,
        width: `${indicatorWidth}px`,
      }"
    />
    <slot />
  </TabsList>
</template>
