<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, Link2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import NewsPoster from "~/components/news/NewsPoster.vue";
import NewsStatusLine from "~/components/news/NewsStatusLine.vue";
import { newsOutline } from "~/utilities/newsMarkdown";
import { useNewsShare } from "~/composables/useNewsShare";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import type { NewsCardArticle } from "~/components/news/newsTypes";

/**
 * The newest post, given the room the rest of the page doesn't get: its cover
 * whole on the left, and beside it the summary plus the sections it covers,
 * each a link straight into that part of the post.
 */
const props = defineProps<{
  article: NewsCardArticle;
  isNew?: boolean;
  views?: string | number | null;
}>();

const { copyNewsLink } = useNewsShare();

const outline = computed(() => newsOutline(props.article.content_markdown));
const to = computed(() =>
  props.article.slug ? `/news/${props.article.slug}` : "/news",
);
</script>

<template>
  <article
    class="grid overflow-hidden rounded-xl border border-[hsl(var(--tac-amber)/0.3)] bg-card/40 transition-colors duration-150 has-[[data-card-link]:hover]:border-[hsl(var(--tac-amber)/0.6)] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
    aria-labelledby="news-lead-title"
  >
    <NuxtLink
      :to="to"
      data-card-link
      :aria-label="article.title"
      class="group/news relative isolate flex items-center overflow-hidden border-b border-border bg-[hsl(240_10%_2%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:border-b-0 lg:border-r"
    >
      <!-- Fills the column when the summary beside it runs taller than the cover. -->
      <img
        v-if="article.cover_image_url"
        :src="article.cover_image_url"
        alt=""
        aria-hidden="true"
        referrerpolicy="no-referrer"
        class="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-70 blur-2xl brightness-[0.45] saturate-125"
      />
      <NewsPoster
        :src="article.cover_image_url"
        :rounded="false"
        eager
        class="!bg-transparent !shadow-none"
      />
    </NuxtLink>

    <div class="flex min-w-0 flex-col gap-3 p-4 sm:p-6">
      <NewsStatusLine
        :published-at="article.published_at"
        :minutes="outline.minutes"
        :is-new="isNew"
        :views="views"
      />
      <h2
        id="news-lead-title"
        class="m-0 text-[clamp(1.375rem,2.1vw,1.875rem)] font-extrabold leading-[1.1] [text-wrap:balance]"
      >
        <NuxtLink
          :to="to"
          class="transition-colors duration-150 hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:underline"
        >
          {{ article.title }}
        </NuxtLink>
      </h2>
      <p
        v-if="article.teaser"
        class="m-0 text-[0.9375rem] leading-relaxed text-foreground/80 [text-wrap:pretty]"
      >
        {{ article.teaser }}
      </p>

      <div v-if="outline.sections.length" class="mt-0.5 grid gap-1.5">
        <h3 :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.news.in_this_post") }}
        </h3>
        <ul class="m-0 grid list-none gap-px p-0">
          <li v-for="section in outline.sections" :key="section.id">
            <NuxtLink
              :to="`${to}#${section.id}`"
              class="group/section flex items-center gap-2.5 py-1 text-[0.8125rem] text-foreground/80 transition-colors duration-150 hover:text-foreground"
            >
              <span
                aria-hidden="true"
                class="h-[5px] w-[5px] shrink-0 rotate-45 bg-[hsl(var(--tac-amber)/0.75)]"
              ></span>
              <span
                class="group-hover/section:underline group-hover/section:underline-offset-[3px]"
              >
                {{ section.text }}
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div class="mt-auto flex flex-wrap items-center gap-2 pt-1.5">
        <Button
          as-child
          class="h-9 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
        >
          <NuxtLink :to="to">
            {{ $t("pages.news.read_post") }}
            <ArrowRight class="h-4 w-4" />
          </NuxtLink>
        </Button>
        <Button
          v-if="article.slug"
          variant="outline"
          class="h-9"
          @click="copyNewsLink(article.slug)"
        >
          <Link2 class="h-4 w-4" />
          {{ $t("pages.news.copy_link") }}
        </Button>
      </div>
    </div>
  </article>
</template>
