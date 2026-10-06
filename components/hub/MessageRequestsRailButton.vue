<script setup lang="ts">
import { Inbox } from "lucide-vue-next";

// The chat rail's way into message requests. Shown only while some wait, with
// how many -- in amber, not the red of an unread badge, since a request is not
// something anyone is owed an answer to.
defineProps<{ active?: boolean; count: number }>();
defineEmits<{ (e: "click"): void }>();
</script>

<template>
  <button
    type="button"
    class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :class="
      active
        ? 'text-[hsl(var(--tac-amber))]'
        : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-[hsl(var(--tac-amber))]'
    "
    :aria-label="$t('layouts.chat_panel.requests.open', { count })"
    :aria-pressed="active"
    @click="$emit('click')"
  >
    <span
      class="flex h-7 w-7 items-center justify-center rounded-md border transition-colors"
      :class="
        active
          ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)]'
          : 'border-zinc-700'
      "
    >
      <Inbox class="h-3.5 w-3.5" />
    </span>
    <span
      class="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--tac-amber))] px-1 text-[0.6rem] font-bold tabular-nums leading-none text-black"
    >
      {{ count > 99 ? "99+" : count }}
    </span>
  </button>
</template>
