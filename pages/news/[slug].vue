<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import NewsArticleView from "~/components/news/NewsArticleView.vue";
import { ArrowLeft, PencilLine } from "lucide-vue-next";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { newsArticleFields } from "~/graphql/newsGraphql";

interface NewsAuthor {
  steam_id: string;
  name: string;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  country: string | null;
  role: string | null;
}

interface NewsArticle {
  id: string;
  slug: string | null;
  title: string;
  teaser: string | null;
  content_markdown: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  author_steam_id: string | null;
  author: NewsAuthor | null;
}

const route = useRoute();
const slug = computed(() => String(route.params.slug));

const article = ref<NewsArticle | null>(null);
const loading = ref(true);

const newsEnabled = computed(() => useApplicationSettingsStore().newsEnabled);
const canPostNews = computed(() => useApplicationSettingsStore().canPostNews);
const apiDomain = computed(() => useRuntimeConfig().public.apiDomain);

useSeoMeta({
  title: () => article.value?.title || undefined,
  ogTitle: () => article.value?.title || undefined,
  description: () => article.value?.teaser || undefined,
  ogDescription: () => article.value?.teaser || undefined,
  ogImage: () => article.value?.cover_image_url || undefined,
  ogType: "article",
  twitterCard: () =>
    article.value?.cover_image_url ? "summary_large_image" : "summary",
});

const authorAvatar = computed(() => {
  const a = article.value?.author;
  if (!a) {
    return null;
  }
  return resolveAvatarUrl(a.custom_avatar_url || a.avatar_url, apiDomain.value);
});

const formatDate = (value: string | null) => {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const wasUpdated = computed(() => {
  const a = article.value;
  if (!a?.updated_at || !a?.published_at) {
    return false;
  }
  return new Date(a.updated_at).getTime() - new Date(a.published_at).getTime() > 60_000;
});

const trackView = (articleSlug: string | null) => {
  if (!import.meta.client || !articleSlug) {
    return;
  }
  const key = `news-viewed:${articleSlug}`;
  if (sessionStorage.getItem(key)) {
    return;
  }
  sessionStorage.setItem(key, "1");
  fetch(`https://${apiDomain.value}/news/${encodeURIComponent(articleSlug)}/view`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
};

const fetchArticle = async () => {
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        news_articles: [
          {
            where: { slug: { _eq: slug.value } },
            order_by: [{ published_at: order_by.desc_nulls_last }],
            limit: 1,
          },
          newsArticleFields,
        ],
      }),
      fetchPolicy: "network-only",
    });
    const found =
      (data as { news_articles: NewsArticle[] }).news_articles[0] ?? null;
    if (!found) {
      return navigateTo("/news");
    }
    article.value = found;
    useNotificationStore().markNewsRead(found.published_at);
    trackView(found.slug);
  } catch {
    return navigateTo("/news");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (!newsEnabled.value) {
    navigateTo("/");
    return;
  }
  fetchArticle();
});
</script>

<template>
  <PageTransition>
    <div class="mx-auto w-full max-w-3xl">
      <div class="flex items-center justify-between">
        <NuxtLink to="/news">
          <Button variant="ghost" size="sm" class="gap-1">
            <ArrowLeft class="h-4 w-4" />
            {{ $t("pages.news.back") }}
          </Button>
        </NuxtLink>
        <NuxtLink v-if="canPostNews && article" :to="`/news/manage/${article.id}`">
          <Button variant="outline" size="sm" class="gap-2">
            <PencilLine class="h-4 w-4" />
            {{ $t("pages.news.manage.edit") }}
          </Button>
        </NuxtLink>
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <div class="mx-auto w-full max-w-3xl space-y-6">
      <template v-if="loading">
        <Skeleton class="h-24 w-full rounded-lg" />
        <Skeleton class="h-96 w-full rounded-lg" />
      </template>

      <template v-else-if="article">
        <NewsArticleView
          :title="article.title"
          :teaser="article.teaser"
          :cover-image-url="article.cover_image_url"
          :content-markdown="article.content_markdown"
          :published-at="article.published_at"
        >
          <template #footer>
            <footer
              v-if="article.author || wasUpdated"
              class="flex items-center gap-3 border-t border-border/60 pt-6"
            >
          <NuxtLink
            v-if="article.author"
            :to="{ name: 'players-id', params: { id: article.author.steam_id } }"
            class="flex items-center gap-3 group"
          >
            <Avatar shape="square" class="h-9 w-9">
              <AvatarImage
                v-if="authorAvatar"
                :src="authorAvatar"
                :alt="article.author.name"
              />
              <AvatarFallback>
                {{ article.author.name.slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
            <div class="leading-tight">
              <div
                class="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("pages.news.written_by") }}
              </div>
              <div
                class="text-sm font-semibold text-foreground transition-colors group-hover:text-[hsl(var(--tac-amber))]"
              >
                {{ article.author.name }}
                <span
                  v-if="article.author.role"
                  class="font-normal capitalize text-muted-foreground"
                >
                  · {{ article.author.role.replace("_", " ") }}
                </span>
              </div>
            </div>
          </NuxtLink>

              <span
                v-if="wasUpdated"
                class="ml-auto text-xs text-muted-foreground"
              >
                {{
                  $t("pages.news.updated", {
                    date: formatDate(article.updated_at),
                  })
                }}
              </span>
            </footer>
          </template>
        </NewsArticleView>
      </template>
    </div>
  </PageTransition>
</template>
