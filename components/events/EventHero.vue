<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Images } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
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

const videoEl = ref<HTMLVideoElement | null>(null);
let videoObserver: IntersectionObserver | null = null;

watch(videoEl, (video) => {
  videoObserver?.disconnect();
  videoObserver = null;
  if (!video || typeof IntersectionObserver === "undefined") {
    return;
  }

  videoObserver = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
  videoObserver.observe(video);
});

onBeforeUnmount(() => {
  videoObserver?.disconnect();
});

// Mirror the event page's "Organized by" precedence: the creator (unless
// hidden) followed by the co-organizers, deduped against the creator.
const organizers = computed(() => {
  const e = props.event;
  const list: any[] = [];
  if (!e.hide_creator_organizer && e.organizer) {
    list.push({ steam_id: e.organizer_steam_id, ...e.organizer });
  }
  for (const entry of e.organizers || []) {
    if (String(entry.steam_id) === String(e.organizer_steam_id)) continue;
    list.push({ steam_id: entry.steam_id, ...entry.organizer });
  }
  return list;
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
    class="group/event relative block h-[220px] overflow-hidden rounded-xl border border-border/70 transition-[border-color,transform] duration-200 hover:-translate-y-px hover:border-[hsl(var(--tac-amber)/0.45)] sm:h-[250px] lg:h-[290px]"
  >
    <!-- backdrop -->
    <img
      v-if="bannerSrc && !isVideo"
      :src="bannerSrc"
      aria-hidden="true"
      loading="lazy"
      class="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover/event:scale-105"
    />
    <video
      v-else-if="bannerSrc && isVideo"
      ref="videoEl"
      :src="bannerSrc"
      aria-hidden="true"
      class="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover/event:scale-105"
      preload="none"
      muted
      loop
      playsinline
    />
    <div v-else aria-hidden="true" class="event-plate absolute inset-0"></div>

    <!-- Same treatment as the tournament card: a modest global tint pushes the
         banner into the background, then the text zones get their own scrims. -->
    <div
      v-if="bannerSrc"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 bg-black/25"
    ></div>
    <div
      aria-hidden="true"
      class="tac-scanlines pointer-events-none absolute inset-0"
    ></div>
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-[linear-gradient(180deg,hsl(0_0%_0%/0.6)_0%,transparent_100%)]"
    ></div>
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-[linear-gradient(180deg,transparent_0%,hsl(0_0%_0%/0.55)_45%,hsl(0_0%_0%/0.94)_100%)]"
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
    <div
      class="absolute inset-x-0 bottom-0 z-[2] px-4 pb-4 pt-6 sm:px-5 sm:pb-5"
    >
      <h3
        class="truncate font-sans text-2xl font-bold uppercase leading-[0.95] tracking-[0.02em] text-white [font-stretch:80%] [text-shadow:0_2px_16px_rgba(0,0,0,0.85)] sm:text-3xl"
      >
        {{ event.name }}
      </h3>

      <div
        class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[0.68rem] tracking-[0.04em] text-white/85"
      >
        <span
          v-if="
            formatEventDate(event.starts_at) || formatEventDate(event.ends_at)
          "
          class="text-white/70"
        >
          {{ formatEventDate(event.starts_at) || $t("pages.events.date_tbd") }}
          <template v-if="formatEventDate(event.ends_at)">
            – {{ formatEventDate(event.ends_at) }}
          </template>
        </span>
        <span v-if="organizers.length" class="flex items-center gap-1.5">
          <span class="text-white/60">{{ $t("event.card.organized_by") }}</span>
          <PlayerDisplay
            :player="organizers[0]"
            size="xs"
            compact
            :show-flag="false"
            :show-role="false"
            :show-elo="false"
            :show-online="false"
            :tooltip="false"
          />
          <span v-if="organizers.length > 1" class="text-white/60"
            >+{{ organizers.length - 1 }}</span
          >
        </span>
        <span
          v-for="s in bottomStats"
          :key="s.key"
          class="inline-flex items-center gap-1.5"
        >
          <span class="font-bold text-white">{{ s.value }}</span>
          {{ $t(`event.tabs.${s.key}`) }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
<style scoped>
/* The plate stays dark in both themes: the scrims, chips and title above it are
   built for a dark backdrop, the same as a banner photo would be. */
.event-plate {
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
    46px 46px,
    46px 46px;
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
