<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
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

const renderedContent = computed(() => {
  if (!import.meta.client || !article.value?.content_markdown) {
    return "";
  }
  const html = marked.parse(article.value.content_markdown, {
    breaks: true,
  }) as string;
  return DOMPurify.sanitize(html);
});

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
  <div class="space-y-6">
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

    <article class="mx-auto w-full max-w-3xl space-y-6">
      <template v-if="loading">
        <Skeleton class="h-24 w-full rounded-lg" />
        <Skeleton class="h-96 w-full rounded-lg" />
      </template>

      <template v-else-if="article">
        <header class="space-y-4 border-b border-border/60 pb-6">
          <span
            class="inline-flex flex-wrap items-center gap-x-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            <span class="text-[0.7rem] text-[hsl(var(--tac-amber))]">◢</span>
            <span v-if="article.published_at">
              {{ formatDate(article.published_at) }}
            </span>
          </span>

          <h1
            class="text-balance font-sans text-3xl font-bold uppercase leading-tight tracking-[0.02em] text-foreground sm:text-4xl"
          >
            {{ article.title }}
          </h1>

          <p
            v-if="article.teaser"
            class="text-pretty text-lg leading-relaxed text-muted-foreground"
          >
            {{ article.teaser }}
          </p>
        </header>

        <div
          v-if="article.cover_image_url"
          class="aspect-video w-full overflow-hidden rounded-lg border border-border/50 bg-background/60"
        >
          <img
            :src="article.cover_image_url"
            :alt="article.title"
            referrerpolicy="no-referrer"
            class="h-full w-full object-cover"
          />
        </div>

        <ClientOnly>
          <div class="news-content" v-html="renderedContent" />
          <template #fallback>
            <p class="text-muted-foreground">{{ article.teaser }}</p>
          </template>
        </ClientOnly>

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

          <span v-if="wasUpdated" class="ml-auto text-xs text-muted-foreground">
            {{ $t("pages.news.updated", { date: formatDate(article.updated_at) }) }}
          </span>
        </footer>
      </template>
    </article>
  </div>
</template>

<style scoped>
.news-content {
  color: hsl(var(--foreground));
  line-height: 1.7;
  font-size: 1.05rem;
}
.news-content :deep(h1),
.news-content :deep(h2),
.news-content :deep(h3),
.news-content :deep(h4) {
  font-weight: 700;
  line-height: 1.25;
  margin-top: 1.75rem;
  margin-bottom: 0.75rem;
}
.news-content :deep(h1) {
  font-size: 1.8rem;
}
.news-content :deep(h2) {
  font-size: 1.5rem;
}
.news-content :deep(h3) {
  font-size: 1.25rem;
}
.news-content :deep(p) {
  margin-bottom: 1rem;
}
.news-content :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}
.news-content :deep(ul),
.news-content :deep(ol) {
  margin: 0 0 1rem 1.5rem;
}
.news-content :deep(ul) {
  list-style: disc;
}
.news-content :deep(ol) {
  list-style: decimal;
}
.news-content :deep(li) {
  margin-bottom: 0.35rem;
}
.news-content :deep(blockquote) {
  border-left: 3px solid hsl(var(--border));
  padding-left: 1rem;
  color: hsl(var(--muted-foreground));
  margin: 0 0 1rem 0;
}
.news-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem 0;
}
.news-content :deep(pre) {
  background: hsl(var(--muted));
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}
.news-content :deep(code) {
  font-family: var(--font-mono, monospace);
  font-size: 0.875em;
}
.news-content :deep(:not(pre) > code) {
  background: hsl(var(--muted));
  padding: 0.15rem 0.35rem;
  border-radius: 0.25rem;
}
.news-content :deep(hr) {
  border: none;
  border-top: 1px solid hsl(var(--border));
  margin: 1.5rem 0;
}
.news-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}
.news-content :deep(th),
.news-content :deep(td) {
  border: 1px solid hsl(var(--border));
  padding: 0.5rem 0.75rem;
  text-align: left;
}
</style>
