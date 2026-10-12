<script setup lang="ts">
import { computed } from "vue";
import NewsPoster from "~/components/news/NewsPoster.vue";
import NewsStatusLine from "~/components/news/NewsStatusLine.vue";
import { newsOutline } from "~/utilities/newsMarkdown";
import type { NewsCardArticle } from "~/components/news/newsTypes";

/** A post in the grid: its cover, one status line, and the title. */
const props = defineProps<{
  article: NewsCardArticle;
  isNew?: boolean;
  views?: string | number | null;
}>();

const minutes = computed(
  () => newsOutline(props.article.content_markdown).minutes,
);
const to = computed(() =>
  props.article.slug ? `/news/${props.article.slug}` : "/news",
);
</script>

<template>
  <NuxtLink
    :to="to"
    class="group/news grid min-w-0 content-start gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
  >
    <NewsPoster
      :src="article.cover_image_url"
      class="transition-shadow duration-150 group-hover/news:shadow-[inset_0_0_0_1px_hsl(var(--tac-amber)/0.5)]"
    />
    <span class="grid min-w-0 gap-1">
      <NewsStatusLine
        :published-at="article.published_at"
        :minutes="minutes"
        :views="views"
        short
      />
      <span
        class="flex items-baseline gap-2 text-[0.97rem] font-bold leading-snug transition-colors duration-150 group-hover/news:text-[hsl(var(--tac-amber))]"
      >
        <span
          v-if="isNew"
          class="inline-flex h-[1.125rem] shrink-0 items-center self-center rounded px-1.5 text-xs font-bold text-[hsl(var(--tac-amber-foreground))] bg-[hsl(var(--tac-amber))]"
        >
          {{ $t("pages.news.new_badge") }}
        </span>
        <span class="min-w-0">{{ article.title }}</span>
      </span>
    </span>
  </NuxtLink>
</template>
