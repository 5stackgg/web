<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import NewsCredit from "~/components/news/NewsCredit.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import { order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { newsArticleListFields } from "~/graphql/newsGraphql";

interface NewsArticle {
  id: string;
  issue_number: number | null;
  slug: string | null;
  url: string;
  title: string;
  teaser: string | null;
  cover_image_url: string | null;
  author: string | null;
  published_at: string | null;
}

const PER_PAGE = 12;

const articles = ref<NewsArticle[]>([]);
const total = ref(0);
const loading = ref(true);
const page = ref(1);

const tldrNewsEnabled = computed(
  () => useApplicationSettingsStore().tldrNewsEnabled,
);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PER_PAGE)));
const hasNextPage = computed(() => page.value < totalPages.value);

const formatDate = (value: string | null) => {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const articleLink = (article: NewsArticle) => {
  return article.slug ? `/news/${article.slug}` : article.url;
};

const fetchCount = async () => {
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      news_articles_aggregate: [{}, { aggregate: { count: true } }],
    }),
    fetchPolicy: "network-only",
  });
  total.value = (
    data as { news_articles_aggregate: { aggregate: { count: number } } }
  ).news_articles_aggregate.aggregate.count;
};

const fetchArticles = async () => {
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        news_articles: [
          {
            order_by: [{ published_at: order_by.desc_nulls_last }],
            limit: PER_PAGE,
            offset: (page.value - 1) * PER_PAGE,
          },
          newsArticleListFields,
        ],
      }),
      fetchPolicy: "network-only",
    });
    articles.value = (data as { news_articles: NewsArticle[] }).news_articles;
  } finally {
    loading.value = false;
  }
};

watch(page, fetchArticles);

onMounted(() => {
  if (!tldrNewsEnabled.value) {
    navigateTo("/");
    return;
  }
  fetchCount();
  fetchArticles();
});
</script>

<template>
  <div class="container mx-auto max-w-6xl space-y-6 p-4">
    <TacticalPageHeader corners="both">
      <template #description>{{ $t("pages.news.subtitle") }}</template>
      <template #title>{{ $t("pages.news.title") }}</template>
      <template #actions>
        <NewsCredit />
      </template>
    </TacticalPageHeader>

    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="n in 6" :key="n" class="h-72 w-full rounded-xl" />
    </div>

    <div
      v-else-if="articles.length === 0"
      class="rounded-lg border border-dashed border-border/60 p-12 text-center text-muted-foreground"
    >
      {{ $t("pages.news.empty") }}
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="article in articles"
        :key="article.id"
        :to="articleLink(article)"
        class="group"
      >
        <Card
          variant="gradient"
          class="flex h-full flex-col overflow-hidden transition-colors hover:border-primary/50"
        >
          <div class="aspect-video w-full overflow-hidden bg-muted">
            <img
              v-if="article.cover_image_url"
              :src="article.cover_image_url"
              :alt="article.title"
              loading="lazy"
              referrerpolicy="no-referrer"
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div class="flex flex-1 flex-col gap-2 p-4">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge v-if="article.issue_number" variant="secondary">
                {{ $t("pages.news.issue", { number: article.issue_number }) }}
              </Badge>
              <span>{{ formatDate(article.published_at) }}</span>
            </div>
            <h2 class="font-semibold leading-snug group-hover:text-primary">
              {{ article.title }}
            </h2>
            <p
              v-if="article.teaser"
              class="line-clamp-3 text-sm text-muted-foreground"
            >
              {{ article.teaser }}
            </p>
          </div>
        </Card>
      </NuxtLink>
    </div>

    <div
      v-if="!loading && totalPages > 1"
      class="flex items-center justify-between pt-2"
    >
      <Button variant="outline" :disabled="page <= 1" @click="page--">
        {{ $t("common.previous") }}
      </Button>
      <span class="text-sm text-muted-foreground">{{ page }} / {{ totalPages }}</span>
      <Button variant="outline" :disabled="!hasNextPage" @click="page++">
        {{ $t("common.next") }}
      </Button>
    </div>
  </div>
</template>
