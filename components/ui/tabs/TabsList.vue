<script setup lang="ts">
import { cn } from '@/lib/utils'
import { TabsList, type TabsListProps } from 'reka-ui'
import { computed, ref, onMounted, onUnmounted, nextTick, type HTMLAttributes } from 'vue'

const props = withDefaults(
  defineProps<TabsListProps & { class?: HTMLAttributes['class']; variant?: 'default' | 'underline' }>(),
  { variant: 'default' },
)

const delegatedProps = computed(() => {
  const { class: _, variant: _v, ...delegated } = props
  return delegated
})

const listRef = ref<InstanceType<typeof TabsList> | null>(null)
const indicatorX = ref(0)
const indicatorWidth = ref(0)
const hasAnimated = ref(false)

function getEl(): HTMLElement | null {
  const r = listRef.value
  if (!r) return null
  // reka-ui component — try $el, then the ref itself
  if (r.$el) return r.$el as HTMLElement
  if (r instanceof HTMLElement) return r
  return null
}

function updateIndicator() {
  const el = getEl()
  if (!el) return
  const active = el.querySelector('[data-state="active"]') as HTMLElement | null
  if (!active) {
    indicatorWidth.value = 0
    hasAnimated.value = false
    return
  }
  const elRect = el.getBoundingClientRect()
  const activeRect = active.getBoundingClientRect()
  indicatorX.value = activeRect.left - elRect.left
  indicatorWidth.value = activeRect.width
  nextTick(() => {
    hasAnimated.value = true
  })
}

let observer: MutationObserver | null = null

onMounted(() => {
  nextTick(() => {
    updateIndicator()
    const el = getEl()
    if (el) {
      observer = new MutationObserver(updateIndicator)
      observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-state'] })
      window.addEventListener('resize', updateIndicator)
    }
  })
})

onUnmounted(() => {
  observer?.disconnect()
  window.removeEventListener('resize', updateIndicator)
})

const showIndicator = computed(() => indicatorWidth.value > 0)
</script>

<template>
  <TabsList
    ref="listRef"
    v-bind="delegatedProps"
    :class="cn(
      'relative inline-flex items-center justify-center text-muted-foreground',
      variant === 'default' && 'rounded-lg bg-muted p-1',
      variant === 'underline' && 'bg-transparent p-0 gap-1',
      props.class,
    )"
  >
    <!-- Default variant: pill sliding over muted bg -->
    <div
      v-if="variant === 'default'"
      v-show="showIndicator"
      class="absolute top-1 bottom-1 left-0 rounded-md pointer-events-none z-0 bg-[hsl(var(--tac-amber)/0.12)] border border-[hsl(var(--tac-amber)/0.45)] shadow-[0_0_12px_hsl(var(--tac-amber)/0.25)]"
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
    <!-- Underline variant: bottom bar sliding under transparent tabs -->
    <div
      v-if="variant === 'underline'"
      v-show="showIndicator"
      class="absolute bottom-0 left-0 h-0.5 rounded-full pointer-events-none z-0 bg-[hsl(var(--tac-amber))] shadow-[0_0_8px_hsl(var(--tac-amber)/0.45)]"
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
