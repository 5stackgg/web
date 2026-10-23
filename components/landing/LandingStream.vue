<script setup lang="ts">
import StreamControls from "~/components/match/StreamControls.vue";
import StreamLiveTag from "~/components/match/StreamLiveTag.vue";
import {
  DEMO_STREAM_VIEWERS,
  demoStreamMatch,
} from "~/utilities/landing/demoStream";

// The welcome page's "Watch" visual: the watch page's stage over a frame of a
// real 5Stack broadcast. Its HUD names the teams and the score itself, so the
// stage shows no lower third over it.
const match = demoStreamMatch();
</script>

<template>
  <div
    class="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black [container-type:inline-size]"
  >
    <img
      src="/landing/stream.webp"
      alt=""
      decoding="async"
      class="absolute inset-0 h-full w-full object-cover"
    />
    <StreamLiveTag
      :match-id="match.id"
      :viewers="DEMO_STREAM_VIEWERS"
      class="absolute left-3 top-3 z-10"
    />
    <StreamControls
      :fullscreen="false"
      :muted="true"
      :visible="true"
      placement="top"
      align="end"
    />
  </div>
</template>
