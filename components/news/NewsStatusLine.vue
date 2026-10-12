<script setup lang="ts">
import { computed } from "vue";
import { dateLocale } from "~/utilities/dateLocale";
import NewsViewCount from "~/components/news/NewsViewCount.vue";

/**
 * One line of facts about a post, each said once: New · date · read time,
 * then Updated and the author-only view count when they apply.
 */
const props = defineProps<{
  publishedAt?: string | null;
  minutes: number;
  isNew?: boolean;
  updatedAt?: string | null;
  views?: string | number | null;
  short?: boolean;
}>();

// A fix-up minutes after posting isn't news; say "Updated" only a day later.
const UPDATED_AFTER_MS = 24 * 60 * 60 * 1000;

const format = (value: string) =>
  new Date(value).toLocaleDateString(dateLocale(), {
    year: props.short ? undefined : "numeric",
    month: "short",
    day: "numeric",
  });

const published = computed(() =>
  props.publishedAt ? format(props.publishedAt) : "",
);

const updated = computed(() => {
  if (!props.updatedAt || !props.publishedAt) {
    return "";
  }
  const gap =
    new Date(props.updatedAt).getTime() - new Date(props.publishedAt).getTime();
  return gap >= UPDATED_AFTER_MS ? format(props.updatedAt) : "";
});
</script>

<template>
  <p
    class="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.8125rem] text-muted-foreground"
  >
    <template v-if="isNew">
      <span class="font-semibold text-[hsl(var(--tac-amber))]">
        {{ $t("pages.news.new_badge") }}
      </span>
      <span aria-hidden="true">·</span>
    </template>
    <template v-if="published">
      <time :datetime="publishedAt ?? undefined">{{ published }}</time>
      <span aria-hidden="true">·</span>
    </template>
    <span class="tabular-nums">
      {{ $t("pages.news.read_time", { count: minutes }) }}
    </span>
    <template v-if="updated">
      <span aria-hidden="true">·</span>
      <span>{{ $t("pages.news.updated", { date: updated }) }}</span>
    </template>
    <template v-if="views !== null && views !== undefined">
      <span aria-hidden="true">·</span>
      <NewsViewCount :count="views" />
    </template>
  </p>
</template>
