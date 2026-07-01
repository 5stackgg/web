<script setup lang="ts">
import { computed } from "vue";
import { cs2PresenceText } from "~/utilities/cs2Presence";

const props = defineProps<{
  // Raw last_presence_state (object or JSON string).
  state: unknown;
  // Show a muted "Not in CS2 right now" banner when they aren't in CS2 (self view).
  showOffline?: boolean;
}>();

const text = computed(() => cs2PresenceText(props.state));
</script>

<template>
  <!-- Self-contained status banner: full-width, left accent bar + fading tint.
       Used identically in the friends list and the user's own settings page. -->
  <div
    v-if="text"
    class="flex items-center gap-2 rounded-md border-l-2 border-green-500 bg-gradient-to-r from-green-500/15 to-transparent px-2.5 py-1.5 text-xs text-green-300"
  >
    <span class="relative flex h-1.5 w-1.5 shrink-0">
      <span
        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
      />
      <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
    </span>
    <span class="min-w-0 truncate">{{ text }}</span>
  </div>
  <div
    v-else-if="showOffline"
    class="flex items-center gap-2 rounded-md border-l-2 border-muted-foreground/30 bg-gradient-to-r from-muted/40 to-transparent px-2.5 py-1.5 text-xs text-muted-foreground"
  >
    <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
    <span class="min-w-0 truncate">Not in CS2 right now</span>
  </div>
</template>
