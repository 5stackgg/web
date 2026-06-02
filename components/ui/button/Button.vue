<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from "."
import { computed, onBeforeUnmount, ref, useAttrs, watch } from "vue"
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from "."
import { Spinner } from "@/components/ui/spinner"

defineOptions({
  inheritAttrs: false,
})

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"]
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
  loading?: boolean
  disabled?: boolean
  minLoadingMs?: number
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  minLoadingMs: 2000,
})

const attrs = useAttrs()

const pending = ref(false)

const rawBusy = computed(() => !!props.loading || pending.value)

const held = ref(false)

let busyStart = 0
let holdTimer: ReturnType<typeof setTimeout> | null = null

watch(rawBusy, (now, prev) => {
  if (now && !prev) {
    busyStart = Date.now()
    held.value = true
    if (holdTimer) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
  } else if (!now && prev) {
    const remaining = props.minLoadingMs - (Date.now() - busyStart)
    if (remaining > 0) {
      holdTimer = setTimeout(() => {
        held.value = false
        holdTimer = null
      }, remaining)
    } else {
      held.value = false
    }
  }
})

onBeforeUnmount(() => {
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
})

const isBusy = computed(() => rawBusy.value || held.value)

const isDisabled = computed(() => props.disabled || isBusy.value)

const forwardedAttrs = computed(() => {
  const { onClick, class: _class, ...rest } = attrs as Record<string, unknown>
  return rest
})

const isTriggerLike = computed(
  () =>
    attrs["aria-haspopup"] != null ||
    attrs["aria-expanded"] != null ||
    attrs["data-state"] != null,
)

async function onClick(event: MouseEvent) {
  if (isDisabled.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  const handler = attrs.onClick as
    | ((event: MouseEvent) => unknown)
    | Array<(event: MouseEvent) => unknown>
    | undefined

  if (!handler) {
    return
  }

  const handlers = Array.isArray(handler) ? handler : [handler]
  const results = handlers.map((fn) => fn(event))

  if (isTriggerLike.value) {
    return
  }

  const promises = results.filter(
    (result): result is Promise<unknown> =>
      !!result && typeof (result as { then?: unknown }).then === "function",
  )

  if (promises.length === 0) {
    return
  }

  pending.value = true
  try {
    await Promise.allSettled(promises)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <Primitive
    v-bind="forwardedAttrs"
    :as="as"
    :as-child="asChild"
    :class="
      cn(buttonVariants({ variant, size }), !asChild && 'relative', props.class)
    "
    :disabled="asChild ? undefined : isDisabled"
    @click="onClick"
  >
    <template v-if="asChild">
      <slot />
    </template>
    <template v-else>
      <Transition
        enter-active-class="transition-all duration-500 ease-out"
        leave-active-class="transition-all duration-300 ease-in"
        enter-from-class="opacity-0 scale-50 rotate-90"
        enter-to-class="opacity-100 scale-100 rotate-0"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-50"
      >
        <span
          v-if="isBusy"
          class="absolute inset-0 flex items-center justify-center"
        >
          <Spinner />
        </span>
      </Transition>
      <span
        class="inline-flex items-center justify-center gap-2 transition-all duration-500 ease-out"
        :class="isBusy ? 'scale-75 opacity-0 blur-[2px]' : ''"
      >
        <slot />
      </span>
    </template>
  </Primitive>
</template>
