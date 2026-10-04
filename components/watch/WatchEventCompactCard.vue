<script setup lang="ts">
import { computed } from "vue";
import { NuxtLink } from "#components";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import { eventPhase } from "~/utilities/eventDisplay";
import { formatEventRange } from "~/utilities/watchEventCard";

// `quickLook` makes the card a quick-look button instead of a link.
const props = defineProps<{ event: any; quickLook?: boolean }>();
const emit = defineEmits<{ (e: "quick-look"): void }>();

const phase = computed(() => eventPhase(props.event));

const bannerSrc = computed(() =>
  props.event.banner && !props.event.banner.mime_type?.startsWith("video/")
    ? eventMediaUrl(props.event.id, props.event.banner.filename)
    : null,
);

const range = computed(() =>
  formatEventRange(props.event.starts_at, props.event.ends_at),
);

const facts = computed(() => {
  const count = (key: string) =>
    props.event[`${key}_aggregate`]?.aggregate?.count ?? 0;
  const list =
    phase.value === "upcoming"
      ? [
          { key: "count_tournaments", value: count("tournaments") },
          { key: "players_signed_up", value: count("players") },
        ]
      : phase.value === "finished"
        ? [
            { key: "count_tournaments", value: count("tournaments") },
            { key: "count_media", value: count("media") },
          ]
        : [
            { key: "count_tournaments", value: count("tournaments") },
            { key: "count_teams", value: count("teams") },
          ];
  return list.filter((fact) => fact.value > 0);
});

const chipClasses = computed(() => {
  if (phase.value === "live") {
    return "text-destructive ring-destructive/50";
  }
  if (phase.value === "upcoming") {
    return "text-[hsl(var(--tac-amber))] ring-[hsl(var(--tac-amber)/0.5)]";
  }
  return "text-foreground/85 ring-white/[0.12]";
});
</script>

<template>
  <component
    :is="quickLook ? 'button' : NuxtLink"
    v-bind="quickLook ? { type: 'button' } : { to: `/events/${event.id}` }"
    class="grid grid-cols-[6.5rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card/40 text-left transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[8.75rem_minmax(0,1fr)]"
    @click="quickLook && emit('quick-look')"
  >
    <img
      v-if="bannerSrc"
      :src="bannerSrc"
      alt=""
      loading="lazy"
      class="h-full min-h-[7.75rem] w-full object-cover"
    />
    <div
      v-else
      aria-hidden="true"
      class="h-full min-h-[7.75rem] w-full bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,hsl(220_10%_20%/0.6),transparent_70%)] bg-muted/40"
    ></div>
    <div class="grid min-w-0 content-center gap-1.5 px-3.5 py-3">
      <div
        class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      >
        <span
          class="inline-flex h-[22px] items-center whitespace-nowrap rounded-md px-[7px] text-xs font-semibold ring-1 ring-inset"
          :class="chipClasses"
        >
          {{ $t(`event.phase.${phase}`) }}
        </span>
        <span v-if="range">{{ range }}</span>
      </div>
      <h3 class="m-0 truncate text-base font-bold leading-tight">
        {{ event.name }}
      </h3>
      <div
        v-if="facts.length"
        class="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.8125rem] text-muted-foreground"
      >
        <span v-for="fact in facts" :key="fact.key">
          <b class="font-semibold tabular-nums text-foreground">{{
            fact.value
          }}</b>
          {{ $t(`pages.watch.events.${fact.key}`, fact.value) }}
        </span>
      </div>
    </div>
  </component>
</template>
