<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Presentational view of a full news article — date, title, teaser, cover, and
 * rendered markdown body. Shared by the published article page
 * (news/[slug].vue) and the editor's full-post preview so the draft preview
 * matches exactly what readers see. Page concerns (nav, SEO, view tracking,
 * author footer) stay with the consumers via the default slot.
 */
const props = defineProps<{
  title: string;
  teaser?: string | null;
  coverImageUrl?: string | null;
  contentMarkdown?: string | null;
  publishedAt?: string | null;
}>();

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const renderedContent = computed(() => {
  if (!import.meta.client || !props.contentMarkdown) {
    return "";
  }
  const html = marked.parse(props.contentMarkdown, { breaks: true }) as string;
  return DOMPurify.sanitize(html);
});
</script>

<template>
  <article class="space-y-6">
    <header class="space-y-4 border-b border-border/60 pb-6">
      <span
        class="inline-flex flex-wrap items-center gap-x-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
      >
        <span class="text-[0.7rem] text-[hsl(var(--tac-amber))]">◢</span>
        <span v-if="publishedAt">{{ formatDate(publishedAt) }}</span>
      </span>

      <h1
        class="text-balance font-sans text-3xl font-bold uppercase leading-tight tracking-[0.02em] text-foreground sm:text-4xl"
      >
        {{ title || $t("pages.news.form.title_placeholder") }}
      </h1>

      <p
        v-if="teaser"
        class="text-pretty text-lg leading-relaxed text-muted-foreground"
      >
        {{ teaser }}
      </p>
    </header>

    <div
      v-if="coverImageUrl"
      class="aspect-video w-full overflow-hidden rounded-lg border border-border/50 bg-background/60"
    >
      <img
        :src="coverImageUrl"
        :alt="title"
        referrerpolicy="no-referrer"
        class="h-full w-full object-cover"
      />
    </div>

    <ClientOnly>
      <div
        v-if="contentMarkdown"
        class="news-content"
        v-html="renderedContent"
      />
      <p v-else class="text-muted-foreground">
        {{ $t("pages.news.form.preview_empty") }}
      </p>
      <template #fallback>
        <p class="text-muted-foreground">{{ teaser }}</p>
      </template>
    </ClientOnly>

    <slot name="footer" />
  </article>
</template>
