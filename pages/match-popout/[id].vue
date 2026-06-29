<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import LiveStreamPlayer from "~/components/match/LiveStreamPlayer.vue";
import { announceMatchPopout } from "~/composables/useMatchPopout";

// Chromeless single-purpose route — opened via window.open() from
// LiveStreamPlayer's "Popout" button. We strip the app layout so
// the user gets just the player + scoreboard + audio/PiP controls,
// and can resize the OS window freely.

definePageMeta({ layout: false });

const route = useRoute();
const matchId = computed(() => String(route.params.id));

// Advertise our lifecycle so the opener tab suppresses its inline
// player (and any duplicate WHEP connection) while this window lives.
let stopAnnouncing: (() => void) | undefined;
onMounted(() => {
  stopAnnouncing = announceMatchPopout(matchId.value);
});
onBeforeUnmount(() => {
  stopAnnouncing?.();
});
</script>

<template>
  <div class="flex h-screen w-screen flex-col overflow-hidden bg-black">
    <LiveStreamPlayer
      :match-id="matchId"
      :in-popout="true"
      class="h-full w-full [&>div]:rounded-none [&>div]:border-0"
    />
  </div>
</template>
