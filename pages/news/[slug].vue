<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import NewsArticleView from "~/components/news/NewsArticleView.vue";
import NewsCard from "~/components/news/NewsCard.vue";
import NewsPoster from "~/components/news/NewsPoster.vue";
import NewsComments from "~/components/news/NewsComments.vue";
import BackLink from "~/components/common/BackLink.vue";
import { ArrowLeft, ArrowRight, Link2, PencilLine } from "lucide-vue-next";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { dateLocale } from "~/utilities/dateLocale";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  newsArticleCardFields,
  newsArticleFields,
  newsPostViewFields,
} from "~/graphql/newsGraphql";
import { useNewsReadState } from "~/composables/useNewsReadState";
import { useNewsShare } from "~/composables/useNewsShare";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import type {
  NewsCardArticle,
  NewsFullArticle,
} from "~/components/news/newsTypes";

const route = useRoute();
const slug = computed(() => String(route.params.slug));
// A shared link to one section lands on it.
const initialSection = computed(() =>
  route.hash ? decodeURIComponent(route.hash.slice(1)) : null,
);

const article = ref<NewsFullArticle | null>(null);
const older = ref<NewsCardArticle | null>(null);
const newer = ref<NewsCardArticle | null>(null);
const latest = ref<NewsCardArticle[]>([]);
const viewCount = ref<string | null>(null);
const loading = ref(true);

const newsEnabled = computed(() => useApplicationSettingsStore().newsEnabled);
const newsLabel = computed(() => useApplicationSettingsStore().newsLabel);
const canPostNews = computed(() => useApplicationSettingsStore().canPostNews);
const apiDomain = computed(() => useRuntimeConfig().public.apiDomain);
const { isNew, markRead } = useNewsReadState();
const { copyNewsLink } = useNewsShare();

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
  return resolveAvatarUrl(
    a.custom_avatar_url || a.avatar_url,
    apiDomain.value,
    64,
  );
});

const shortDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(dateLocale(), {
        month: "short",
        day: "numeric",
      })
    : "";

const trackView = async (articleSlug: string | null) => {
  if (!import.meta.client || !articleSlug) {
    return;
  }
  const key = `news-viewed:${articleSlug}`;
  if (sessionStorage.getItem(key)) {
    return;
  }
  sessionStorage.setItem(key, "1");
  await fetch(
    `https://${apiDomain.value}/news/${encodeURIComponent(articleSlug)}/view`,
    {
      method: "POST",
      credentials: "include",
    },
  ).catch(() => {});
};

// The public article query can't select view_count — only authors get it, via
// the admin action, once we know which post we're on.
const fetchViewCount = async (id: string) => {
  if (!canPostNews.value) {
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        newsPostAdmin: [{ id }, newsPostViewFields],
      }),
      fetchPolicy: "network-only",
    });
    viewCount.value =
      (data as { newsPostAdmin: { view_count: string } | null }).newsPostAdmin
        ?.view_count ?? null;
  } catch {
    viewCount.value = null;
  }
};

const published = { status: { _eq: "published" } };

const fetchCards = async (
  where: Record<string, unknown>,
  direction: order_by,
  limit: number,
) => {
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      news_articles: [
        {
          where: { ...published, ...where },
          order_by: [{ published_at: direction }],
          limit,
        },
        newsArticleCardFields,
      ],
    }),
    fetchPolicy: "network-only",
  });
  return (data as { news_articles: NewsCardArticle[] }).news_articles;
};

// The posts either side of this one, and the newest few it isn't next to.
const fetchAround = async (current: NewsFullArticle) => {
  if (!current.published_at) {
    return;
  }
  const at = current.published_at;
  const [before, after, newest] = await Promise.all([
    fetchCards({ published_at: { _lt: at } }, order_by.desc, 1),
    fetchCards({ published_at: { _gt: at } }, order_by.asc, 1),
    fetchCards({}, order_by.desc_nulls_last, 6),
  ]);
  older.value = before[0] ?? null;
  newer.value = after[0] ?? null;
  const shown = new Set([current.id, older.value?.id, newer.value?.id]);
  latest.value = newest.filter((post) => !shown.has(post.id)).slice(0, 3);
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
      (data as { news_articles: NewsFullArticle[] }).news_articles[0] ?? null;
    if (!found) {
      return navigateTo("/news");
    }
    article.value = found;
    markRead(found.published_at);
    // Count this visit first so authors don't read a number that's one behind.
    trackView(found.slug).finally(() => fetchViewCount(found.id));
    fetchAround(found).catch(() => {});
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
    <div>
      <BackLink
        to="/news"
        class="mb-3.5 inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft class="h-3.5 w-3.5" />
        {{ newsLabel || $t("pages.news.title") }}
      </BackLink>

      <div
        v-if="loading"
        class="overflow-hidden rounded-2xl border border-border"
        aria-busy="true"
      >
        <Skeleton class="aspect-video max-h-[30rem] w-full rounded-none" />
        <div class="grid gap-3 px-4 pb-5 pt-4 sm:px-6 sm:pt-5">
          <Skeleton class="h-4 w-48" />
          <Skeleton class="h-10 w-2/3" />
          <Skeleton class="h-5 w-1/2" />
        </div>
      </div>

      <NewsArticleView
        v-else-if="article"
        :title="article.title"
        :teaser="article.teaser"
        :cover-image-url="article.cover_image_url"
        :content-markdown="article.content_markdown"
        :published-at="article.published_at"
        :updated-at="article.updated_at"
        :views="canPostNews ? viewCount : null"
        :slug="article.slug"
        :initial-section="initialSection"
      >
        <template v-if="article.author" #byline>
          <NuxtLink
            :to="{
              name: 'players-id',
              params: { id: article.author.steam_id },
            }"
            class="group flex min-w-0 items-center gap-2.5"
          >
            <Avatar shape="square" class="h-8 w-8">
              <AvatarImage
                v-if="authorAvatar"
                :src="authorAvatar"
                :alt="article.author.name"
              />
              <AvatarFallback>
                {{ article.author.name.slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
            <span class="grid leading-tight">
              <span
                class="text-[0.8125rem] font-semibold transition-colors duration-150 group-hover:text-[hsl(var(--tac-amber))]"
              >
                {{ article.author.name }}
              </span>
              <span
                v-if="article.author.role"
                class="text-xs capitalize text-muted-foreground"
              >
                {{ $t(`player_roles.${article.author.role}`) }}
              </span>
            </span>
          </NuxtLink>
        </template>

        <template #actions>
          <Button
            v-if="article.slug"
            variant="outline"
            size="sm"
            @click="copyNewsLink(article.slug)"
          >
            <Link2 class="h-4 w-4" />
            {{ $t("pages.news.copy_link") }}
          </Button>
          <Button v-if="canPostNews" as-child variant="outline" size="sm">
            <NuxtLink :to="`/news/manage/${article.id}`">
              <PencilLine class="h-4 w-4" />
              {{ $t("pages.news.manage.edit") }}
            </NuxtLink>
          </Button>
        </template>

        <template #footer>
          <NewsComments
            :article-id="article.id"
            :slug="article.slug"
            :published-at="article.published_at"
          />

          <nav
            v-if="older || newer"
            :aria-label="$t('pages.news.around')"
            class="mx-auto mt-11 grid max-w-[66rem] gap-3 sm:grid-cols-2"
          >
            <NuxtLink
              v-if="older"
              :to="`/news/${older.slug}`"
              class="group/news grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3.5 rounded-lg border border-border bg-card/40 p-3 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.5)] sm:grid-cols-[7.5rem_minmax(0,1fr)]"
            >
              <NewsPoster :src="older.cover_image_url" />
              <span class="min-w-0">
                <span
                  class="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <ArrowLeft class="h-3 w-3" />
                  {{ $t("pages.news.older") }} ·
                  {{ shortDate(older.published_at) }}
                </span>
                <b class="mt-1 block text-[0.9rem] font-bold leading-snug">
                  {{ older.title }}
                </b>
              </span>
            </NuxtLink>
            <span v-else class="max-sm:hidden"></span>
            <NuxtLink
              v-if="newer"
              :to="`/news/${newer.slug}`"
              class="group/news grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3.5 rounded-lg border border-border bg-card/40 p-3 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.5)] sm:grid-cols-[minmax(0,1fr)_7.5rem] sm:text-right"
            >
              <NewsPoster :src="newer.cover_image_url" class="sm:order-2" />
              <span class="min-w-0">
                <span
                  class="flex items-center gap-1.5 text-xs text-muted-foreground sm:justify-end"
                >
                  {{ $t("pages.news.newer") }} ·
                  {{ shortDate(newer.published_at) }}
                  <ArrowRight class="h-3 w-3" />
                </span>
                <b class="mt-1 block text-[0.9rem] font-bold leading-snug">
                  {{ newer.title }}
                </b>
              </span>
            </NuxtLink>
          </nav>

          <section
            v-if="latest.length"
            class="mx-auto mt-10 grid max-w-[66rem] gap-3.5"
          >
            <h2 :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.news.latest") }}
            </h2>
            <div
              class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              <NewsCard
                v-for="post in latest"
                :key="post.id"
                :article="post"
                :is-new="isNew(post.published_at)"
              />
            </div>
          </section>
        </template>
      </NewsArticleView>
    </div>
  </PageTransition>
</template>
