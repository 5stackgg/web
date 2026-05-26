<script lang="ts" setup>
import type { LabelProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { Label } from '@/components/ui/label'
import { useFormField } from "./useFormField"

const props = defineProps<LabelProps & { class?: HTMLAttributes["class"] }>()

const { error, isTouched, formItemId } = useFormField()
</script>

<template>
  <Label
    :class="cn(
      error && isTouched && 'text-destructive',
      props.class,
    )"
    :for="formItemId"
  >
    <slot />
  </Label>
</template>
