<script setup lang="ts">
import { computed } from "vue";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import {
  eventPhase,
  formatEventDate,
  phaseLabelKey,
} from "~/utilities/eventDisplay";

// Small banner card used for Upcoming events in the index rail.
const props = defineProps<{ event: any }>();

const phase = computed(() => eventPhase(props.event));
const bannerSrc = computed(() =>
  props.event.banner
    ? eventMediaUrl(props.event.id, props.event.banner.filename)
    : null,
);
const isVideo = computed(() =>
  props.event.banner?.mime_type?.startsWith("video/"),
);
const fallbackGradient = computed(() => {
  const id = String(props.event.id);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `radial-gradient(ellipse 60% 90% at 30% 35%, hsl(${h} 60% 42% / 0.85), transparent 60%), radial-gradient(ellipse 50% 80% at 80% 70%, hsl(${(h + 130) % 360} 55% 42% / 0.65), transparent 55%), repeating-linear-gradient(-30deg, rgba(0,0,0,0.3) 0 18px, transparent 18px 36px), #14171c`;
});
</script>

<template>
  <NuxtLink
    :to="{ name: 'events-eventId', params: { eventId: event.id } }"
    class="group flex w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border/70 bg-card/40 transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-[hsl(var(--tac-amber)/0.45)]"
  >
    <div class="relative aspect-video w-full overflow-hidden">
      <img
        v-if="bannerSrc && !isVideo"
        :src="bannerSrc"
        class="h-full w-full object-cover"
        loading="lazy"
      />
      <video
        v-else-if="bannerSrc && isVideo"
        :src="bannerSrc"
        class="h-full w-full object-cover"
        muted
        playsinline
      />
      <div
        v-else
        class="h-full w-full"
        :style="{ background: fallbackGradient }"
      ></div>
      <div
        aria-hidden="true"
        class="tac-scanlines pointer-events-none absolute inset-0"
      ></div>
      <div
        class="pointer-events-none absolute inset-0 flex flex-col justify-between bg-[linear-gradient(180deg,transparent_45%,hsl(0_0%_0%/0.75))] p-2"
      >
        <span
          class="self-start rounded-full bg-[hsl(var(--tac-amber)/0.9)] px-2 py-0.5 font-mono text-[0.54rem] uppercase tracking-[0.14em] text-black"
        >
          {{ $t(phaseLabelKey(phase)) }}
        </span>
        <span
          class="font-sans text-base font-bold uppercase leading-[0.95] tracking-[0.02em] text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]"
        >
          {{ event.name }}
        </span>
      </div>
    </div>
    <div class="px-3 py-2">
      <p
        class="font-mono text-[0.62rem] tracking-[0.06em] text-muted-foreground"
      >
        {{ formatEventDate(event.starts_at) || $t("pages.events.date_tbd") }}
      </p>
    </div>
  </NuxtLink>
</template>
