<script setup lang="ts">
interface Props {
  items: any[]
  cols?: 1 | 2 | 3 | 4
  gap?: number
  staggerDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  cols: 2,
  gap: 6,
  staggerDelay: 50
})

const gridClasses = computed(() => {
  const colsMap = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }
  return `grid ${colsMap[props.cols]} gap-${props.gap}`
})

const getStaggerStyle = (index: number) => ({
  animationDelay: `${index * props.staggerDelay}ms`
})
</script>

<template>
  <div :class="gridClasses">
    <div
      v-for="(item, index) in items"
      :key="index"
      :style="getStaggerStyle(index)"
      class="animate-in fade-in slide-in-from-bottom-2"
    >
      <slot :item="item" :index="index" />
    </div>
  </div>
</template>
