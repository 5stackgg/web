<script setup lang="ts">
import { computed } from "vue";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import {
  eventPhase,
  formatEventDate,
  phaseLabelKey,
} from "~/utilities/eventDisplay";

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
      <div v-else aria-hidden="true" class="event-plate h-full w-full"></div>
      <div
        aria-hidden="true"
        class="tac-scanlines pointer-events-none absolute inset-0"
      ></div>
      <div
        class="pointer-events-none absolute inset-0 flex flex-col justify-between bg-[linear-gradient(180deg,transparent_45%,hsl(0_0%_0%/0.75))] p-2"
      >
        <span
          class="self-start rounded-full px-2 py-0.5 font-mono text-[0.54rem] uppercase tracking-[0.14em] backdrop-blur-sm"
          :class="
            phase === 'live'
              ? 'bg-destructive/25 text-[hsl(var(--destructive))]'
              : phase === 'upcoming'
                ? 'bg-[hsl(var(--tac-amber)/0.22)] text-[hsl(var(--tac-amber))]'
                : 'bg-success/20 text-success'
          "
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
        <template v-if="formatEventDate(event.ends_at)">
          – {{ formatEventDate(event.ends_at) }}
        </template>
      </p>
    </div>
  </NuxtLink>
</template>
<style scoped>
/* Matches EventHero's plate, scaled down: dark in both themes, because the
   scrim and chips above it are built for a dark backdrop. */
.event-plate {
  position: relative;
  background-color: hsl(220 13% 10%);
  background-image:
    radial-gradient(
      130% 100% at 14% -15%,
      hsl(220 16% 27% / 0.85) 0%,
      transparent 62%
    ),
    linear-gradient(hsl(0 0% 100% / 0.03) 1px, transparent 1px),
    linear-gradient(90deg, hsl(0 0% 100% / 0.03) 1px, transparent 1px);
  background-size:
    100% 100%,
    26px 26px,
    26px 26px;
}

.event-plate::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    hsl(var(--tac-amber) / 0.45) 50%,
    transparent 100%
  );
}
</style>
