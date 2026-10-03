<script setup lang="ts">
import { Plus } from "lucide-vue-next";

// The chat rail's "new conversation" button. Lit while the composer is open,
// so it reads as where you are, the same way a conversation's button does.
defineProps<{ active?: boolean }>();
defineEmits<{ (e: "click"): void }>();
</script>

<template>
  <button
    type="button"
    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :class="
      active
        ? 'text-[hsl(var(--tac-amber))]'
        : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-[hsl(var(--tac-amber))]'
    "
    :aria-label="$t('layouts.chat_panel.new_message')"
    :aria-pressed="active"
    @click="$emit('click')"
  >
    <span
      class="flex h-7 w-7 items-center justify-center rounded-md border border-dashed transition-colors"
      :class="
        active
          ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)]'
          : 'border-zinc-700'
      "
    >
      <Plus class="h-3.5 w-3.5" />
    </span>
  </button>
</template>
