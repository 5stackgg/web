<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { ref, computed, onMounted, watch } from "vue";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { PencilLine, Newspaper, PlusCircle } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  newsArticleListFields,
  newsPostViewFields,
} from "~/graphql/newsGraphql";
import NewsViewCount from "~/components/news/NewsViewCount.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import { createButtonClasses } from "~/utilities/tacticalClasses";

interface NewsArticle {
  id: string;
  slug: string | null;
  title: string;
  teaser: string | null;
  cover_image_url: string | null;
  published_at: string | null;
}

const PER_PAGE = 12;

const articles = ref<NewsArticle[]>([]);
const viewCounts = ref<Record<string, string>>({});
const total = ref(0);
const loading = ref(true);
const { skeleton, refreshing, loaded } = useDeferredLoading(
  () => loading.value,
);
const page = ref(1);

const newsEnabled = computed(() => useApplicationSettingsStore().newsEnabled);
const newsLabel = computed(() => useApplicationSettingsStore().newsLabel);
const canPostNews = computed(() => useApplicationSettingsStore().canPostNews);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / PER_PAGE)),
);
const hasNextPage = computed(() => page.value < totalPages.value);

const formatDate = (value: string | null) => {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString(dateLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const articleLink = (article: NewsArticle) => {
  return article.slug ? `/news/${article.slug}` : "/news";
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

// view_count is admin-only, so it comes from the admin action rather than the
// public list query — one fetch covers every page of the list.
const fetchViewCounts = async () => {
  if (!canPostNews.value) {
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        newsPostsAdmin: newsPostViewFields,
      }),
      fetchPolicy: "network-only",
    });
    const posts =
      (data as { newsPostsAdmin: Array<{ id: string; view_count: string }> })
        .newsPostsAdmin ?? [];
    viewCounts.value = Object.fromEntries(
      posts.map((post) => [post.id, post.view_count]),
    );
  } catch {
    viewCounts.value = {};
  }
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
watch(canPostNews, () => fetchViewCounts());

onMounted(() => {
  if (!newsEnabled.value) {
    navigateTo("/");
    return;
  }
  fetchCount();
  fetchArticles();
  fetchViewCounts();
});
</script>

<template>
  <h1 class="sr-only">{{ newsLabel || $t("pages.news.title") }}</h1>

  <PageTransition>
    <div class="space-y-6">
      <div v-if="canPostNews" class="flex justify-end">
        <Button
          as-child
          variant="outline"
          size="sm"
          class="h-8 max-md:w-8 max-md:px-0"
        >
          <NuxtLink
            to="/news/manage"
            :title="$t('pages.settings.application.news.manage')"
          >
            <PencilLine class="h-4 w-4" />
            <span class="max-md:sr-only">{{
              $t("pages.settings.application.news.manage")
            }}</span>
          </NuxtLink>
        </Button>
      </div>

      <FadeSwap>
        <div
          v-if="skeleton"
          key="loading"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
        >
          <Skeleton
            v-for="n in 6"
            :key="n"
            class="aspect-[16/17] w-full rounded-xl"
          />
        </div>

        <SectionEmpty
          v-else-if="loaded && articles.length === 0"
          key="empty"
          :title="newsLabel || $t('pages.news.title')"
          :description="$t('pages.news.empty')"
        >
          <Button
            v-if="canPostNews"
            as-child
            size="sm"
            :class="createButtonClasses"
          >
            <NuxtLink to="/news/manage/new">
              <PlusCircle class="h-4 w-4" />
              {{ $t("pages.news.new_article") }}
            </NuxtLink>
          </Button>
        </SectionEmpty>

        <div
          v-else
          key="list"
          class="grid grid-cols-1 gap-4 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3"
          :class="refreshing && 'pointer-events-none opacity-50'"
        >
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
              <div
                class="flex aspect-video w-full items-center justify-center overflow-hidden bg-background/60"
              >
                <img
                  v-if="article.cover_image_url"
                  :src="article.cover_image_url"
                  :alt="article.title"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <Newspaper v-else class="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div class="flex flex-1 flex-col gap-2 p-4">
                <div
                  class="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span>{{ formatDate(article.published_at) }}</span>
                  <NewsViewCount
                    v-if="canPostNews && viewCounts[article.id] !== undefined"
                    :count="viewCounts[article.id]"
                  />
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
      </FadeSwap>

      <div
        v-if="!skeleton && totalPages > 1"
        class="flex items-center justify-between pt-2"
      >
        <Button variant="outline" :disabled="page <= 1" @click="page--">
          {{ $t("common.previous") }}
        </Button>
        <span class="text-sm text-muted-foreground"
          >{{ page }} / {{ totalPages }}</span
        >
        <Button variant="outline" :disabled="!hasNextPage" @click="page++">
          {{ $t("common.next") }}
        </Button>
      </div>
    </div>
  </PageTransition>
</template>
