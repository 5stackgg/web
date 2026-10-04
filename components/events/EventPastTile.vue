<script setup lang="ts">
import { computed } from "vue";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import { formatEventRange } from "~/utilities/watchEventCard";

const props = defineProps<{ event: any }>();

const bannerSrc = computed(() =>
  props.event.banner && !props.event.banner.mime_type?.startsWith("video/")
    ? eventMediaUrl(props.event.id, props.event.banner.filename)
    : null,
);

const count = (key: string) =>
  props.event[`${key}_aggregate`]?.aggregate?.count ?? 0;
</script>

<template>
  <NuxtLink
    :to="`/events/${event.id}`"
    class="group/tile flex w-56 shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border bg-card/40 text-left transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span class="relative block aspect-[2/1] overflow-hidden bg-muted/40">
      <img
        v-if="bannerSrc"
        :src="bannerSrc"
        alt=""
        loading="lazy"
        class="h-full w-full object-cover transition-transform duration-300 group-hover/tile:scale-[1.04] motion-reduce:transition-none"
      />
    </span>
    <span class="grid min-w-0 gap-1 p-3">
      <b class="line-clamp-2 text-sm font-bold leading-snug">{{ event.name }}</b>
      <span class="text-xs text-muted-foreground">
        {{ formatEventRange(event.starts_at, event.ends_at) }}
      </span>
      <span class="text-xs tabular-nums text-muted-foreground">
        {{ count("tournaments") }}
        {{ $t("pages.watch.events.count_tournaments", count("tournaments")) }}
        <template v-if="count('media')">
          · {{ count("media") }}
          {{ $t("pages.watch.events.count_media", count("media")) }}
        </template>
      </span>
    </span>
  </NuxtLink>
</template>
