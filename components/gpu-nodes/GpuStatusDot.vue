<script setup lang="ts">
// The app's status dot (GameServerNodeDisplay), with the ping kept for work
// that is live right now.
defineProps<{
  tone: "off" | "bad" | "warn" | "ok" | "amber";
  live?: boolean;
}>();
</script>

<template>
  <span
    class="relative inline-flex h-2 w-2 shrink-0 rounded-full"
    :class="{
      'bg-muted-foreground/40': tone === 'off',
      'bg-red-600': tone === 'bad',
      'bg-yellow-600': tone === 'warn',
      'bg-green-600': tone === 'ok',
      'bg-[hsl(var(--tac-amber))]': tone === 'amber',
    }"
  >
    <span
      v-if="live"
      class="absolute inset-0 animate-ping rounded-full opacity-75 motion-reduce:hidden"
      :class="tone === 'amber' ? 'bg-[hsl(var(--tac-amber))]' : 'bg-green-400'"
    />
  </span>
</template>
