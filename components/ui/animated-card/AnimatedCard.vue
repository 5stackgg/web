<script setup lang="ts">
import { Card } from '~/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  variant?: 'default' | 'gradient' | 'elevated'
  hover?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  hover: true
})

const cardClasses = computed(() => {
  const base = 'transition-all duration-500'
  const variants = {
    default: '',
    gradient: 'bg-gradient-to-br from-muted/50 to-muted/30',
    elevated: 'shadow-lg'
  }
  const hoverEffects = props.hover
    ? 'hover:from-muted/70 hover:to-muted/50 hover:shadow-md hover:border-border'
    : ''

  return cn(base, variants[props.variant], hoverEffects, 'border-border/50')
})
</script>

<template>
  <Card :class="cn(cardClasses, props.class)">
    <slot />
  </Card>
</template>
