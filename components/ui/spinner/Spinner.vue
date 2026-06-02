<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Loader } from "lucide-vue-next"
import { cn } from "@/lib/utils"

interface Props {
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <Loader
    :class="cn('h-[1.15em] w-[1.15em] animate-spin-smooth', props.class)"
    role="status"
    aria-label="Loading"
  />
</template>
