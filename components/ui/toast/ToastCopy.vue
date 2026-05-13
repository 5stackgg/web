<script setup lang="ts">
import { ref } from "vue";
import { Check, Copy } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

const props = defineProps<{
  text: string;
  class?: HTMLAttributes["class"];
}>();

const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | null = null;

async function copy(e: Event) {
  // Stop the toast root's swipe / focus handlers from intercepting.
  e.stopPropagation();
  try {
    await navigator.clipboard.writeText(props.text);
  } catch {
    // Fallback for browsers/contexts without async clipboard access.
    const ta = document.createElement("textarea");
    ta.value = props.text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      ta.remove();
    }
  }
  copied.value = true;
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <button
    type="button"
    :aria-label="$t('common.copy')"
    :title="$t('common.copy')"
    :class="
      cn(
        'absolute right-7 top-1 inline-flex items-center justify-center rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600',
        props.class,
      )
    "
    @click="copy"
  >
    <Check v-if="copied" class="h-4 w-4" />
    <Copy v-else class="h-4 w-4" />
  </button>
</template>
