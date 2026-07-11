<script setup lang="ts">
import { computed } from "vue";
import { Images } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import {
  eventPhase,
  formatEventDate,
  phaseLabelKey,
} from "~/utilities/eventDisplay";

// Full-width banner hero used for Live and Finished events. Uses the event's
// banner as a blur-filled backdrop; falls back to a generated gradient keyed
// on the event id when there is no banner.
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

// Deterministic gradient fallback so bannerless events still look intentional.
const fallbackGradient = computed(() => {
  const id = String(props.event.id);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  const a = h;
  const b = (h + 70) % 360;
  const c = (h + 200) % 360;
  return `radial-gradient(ellipse 55% 90% at 22% 40%, hsl(${a} 60% 40% / 0.85), transparent 60%), radial-gradient(ellipse 45% 80% at 70% 60%, hsl(${b} 55% 42% / 0.7), transparent 55%), radial-gradient(ellipse 40% 70% at 90% 25%, hsl(${c} 60% 45% / 0.6), transparent 55%), repeating-linear-gradient(-35deg, rgba(0,0,0,0.32) 0 20px, transparent 20px 40px), #14171c`;
});

const mediaCount = computed(
  () => props.event.media_aggregate?.aggregate?.count ?? 0,
);
const bottomStats = computed(() =>
  [
    {
      key: "tournaments",
      value: props.event.tournaments_aggregate?.aggregate?.count ?? 0,
    },
    {
      key: "teams",
      value: props.event.teams_aggregate?.aggregate?.count ?? 0,
    },
  ].filter((s) => s.value > 0),
);
</script>

<template>
  <NuxtLink
    :to="{ name: 'events-eventId', params: { eventId: event.id } }"
    class="group relative block h-[220px] overflow-hidden rounded-xl border border-border/70 transition-[border-color,transform] duration-200 hover:-translate-y-px hover:border-[hsl(var(--tac-amber)/0.45)] sm:h-[260px]"
  >
    <!-- backdrop -->
    <img
      v-if="bannerSrc && !isVideo"
      :src="bannerSrc"
      aria-hidden="true"
      class="absolute inset-0 h-full w-full scale-105 object-cover"
    />
    <video
      v-else-if="bannerSrc && isVideo"
      :src="bannerSrc"
      aria-hidden="true"
      class="absolute inset-0 h-full w-full scale-105 object-cover"
      autoplay
      muted
      loop
      playsinline
    />
    <div
      v-else
      class="absolute inset-0"
      :style="{ background: fallbackGradient }"
    ></div>

    <div
      aria-hidden="true"
      class="tac-scanlines pointer-events-none absolute inset-0"
    ></div>
    <!-- lighter scrims: just enough for legibility at the corners so the
         banner stays the highlight. -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(180deg,hsl(0_0%_0%/0.55)_0%,transparent_100%)]"
    ></div>
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-[linear-gradient(180deg,transparent_0%,hsl(0_0%_0%/0.85)_100%)]"
    ></div>

    <!-- TOP-RIGHT: status · visibility · media -->
    <div
      class="absolute right-3 top-3 z-[2] flex flex-wrap items-center justify-end gap-1.5"
    >
      <span
        v-if="mediaCount > 0"
        class="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm"
      >
        <Images class="h-3 w-3" />
        {{ mediaCount }}
      </span>
      <span
        v-if="event.visibility && event.visibility !== 'Public'"
        class="inline-flex items-center rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-black/60 px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))] backdrop-blur-sm"
      >
        {{ $t(`event.visibility.${event.visibility.toLowerCase()}`) }}
      </span>
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] backdrop-blur-sm"
        :class="
          phase === 'live'
            ? 'bg-destructive/25 text-[hsl(var(--destructive))]'
            : phase === 'upcoming'
              ? 'bg-[hsl(var(--tac-amber)/0.22)] text-[hsl(var(--tac-amber))]'
              : 'bg-success/20 text-success'
        "
      >
        <span
          v-if="phase === 'live'"
          class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--destructive))]"
        ></span>
        {{ $t(phaseLabelKey(phase)) }}
      </span>
    </div>

    <!-- BOTTOM-LEFT: title, then date · organizer · counts -->
    <div class="absolute inset-x-0 bottom-0 z-[2] p-5 sm:p-7">
      <h3
        class="font-sans text-2xl font-bold uppercase leading-[0.9] tracking-[0.02em] text-white [font-stretch:80%] [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] sm:text-4xl"
      >
        {{ event.name }}
      </h3>

      <div
        class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/85"
      >
        <span
          v-if="
            formatEventDate(event.starts_at) || formatEventDate(event.ends_at)
          "
          class="font-mono tracking-[0.06em]"
        >
          {{ formatEventDate(event.starts_at) || $t("pages.events.date_tbd") }}
          <template v-if="formatEventDate(event.ends_at)">
            – {{ formatEventDate(event.ends_at) }}
          </template>
        </span>
        <span v-if="event.organizer" class="flex items-center gap-1.5">
          <span class="text-white/50">{{ $t("event.card.organized_by") }}</span>
          <PlayerDisplay
            :player="event.organizer"
            size="xs"
            compact
            :show-flag="false"
            :show-role="false"
            :show-elo="false"
            :show-online="false"
            :tooltip="false"
          />
        </span>
        <span
          v-for="s in bottomStats"
          :key="s.key"
          class="font-mono tracking-[0.06em]"
        >
          <span class="font-bold text-white">{{ s.value }}</span>
          {{ $t(`event.tabs.${s.key}`) }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
