<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import DesktopSnapshot from "~/components/match/DesktopSnapshot.vue";
import {
  streamPlatform,
  streamPlatformMeta,
  type WatchStream,
} from "~/components/watch/streamPlatform";

// A still of a live stream: the game streamer's desktop snapshot, Twitch's
// CDN preview (refreshed every 30s) or YouTube's poster, else the platform
// mark. `locked` blacks it out for signed-out viewers when live streams
// need a login (anti-cheat: no peeking at the game).
const props = defineProps<{
  matchId: string;
  stream: WatchStream | null;
  locked?: boolean;
  alt?: string;
}>();

const parsed = computed(() => streamPlatform(props.stream));
const meta = computed(() => streamPlatformMeta(props.stream));

const bust = ref(Math.floor(Date.now() / 30000));
const timer =
  typeof window !== "undefined"
    ? setInterval(() => (bust.value = Math.floor(Date.now() / 30000)), 30_000)
    : null;
onBeforeUnmount(() => timer && clearInterval(timer));

const imageUrl = computed<string | null>(() => {
  const p = parsed.value;
  if (!p?.id) return null;
  if (p.platform === "twitch") {
    return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${p.id}-1280x720.jpg?b=${bust.value}`;
  }
  if (p.platform === "youtube") {
    return `https://img.youtube.com/vi/${p.id}/maxresdefault.jpg`;
  }
  return null;
});

const failed = ref(false);
watch(imageUrl, () => (failed.value = false));
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-black">
    <div
      v-if="locked"
      class="flex h-full w-full items-center justify-center px-2 text-center text-xs text-white/60"
    >
      {{ $t("pages.watch.stage.login_short") }}
    </div>
    <DesktopSnapshot
      v-else-if="parsed?.platform === 'internal'"
      kind="live"
      :id="matchId"
      :alt="alt ?? ''"
      class="h-full !aspect-auto"
    />
    <img
      v-else-if="imageUrl && !failed"
      :src="imageUrl"
      :alt="alt ?? ''"
      loading="lazy"
      referrerpolicy="no-referrer"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,hsl(var(--muted)/0.5)_0%,hsl(var(--background))_70%)]"
    >
      <component
        :is="meta.icon"
        v-if="meta?.icon"
        class="size-8 text-muted-foreground/50"
      />
    </div>
    <slot />
  </div>
</template>
