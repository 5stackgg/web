<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { PlusCircle } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { useNewsReadState } from "~/composables/useNewsReadState";
import { order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { newsArticleCardFields } from "~/graphql/newsGraphql";
import NewsLead from "~/components/news/NewsLead.vue";
import NewsCard from "~/components/news/NewsCard.vue";
import NewsDrafts from "~/components/news/NewsDrafts.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import {
  createButtonClasses,
  listCreateButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import type { NewsCardArticle, NewsDraft } from "~/components/news/newsTypes";

// The lead plus three full rows of three; "Show older" adds rows of three.
const FIRST_PAGE = 10;
const MORE_PAGE = 9;

const articles = ref<NewsCardArticle[]>([]);
const drafts = ref<NewsDraft[]>([]);
const viewCounts = ref<Record<string, string>>({});
const total = ref(0);
const loading = ref(true);
const loadingMore = ref(false);
const publishing = ref<string | null>(null);
const { skeleton, refreshing, loaded } = useDeferredLoading(
  () => loading.value,
);

const newsEnabled = computed(() => useApplicationSettingsStore().newsEnabled);
const newsLabel = computed(() => useApplicationSettingsStore().newsLabel);
const canPostNews = computed(() => useApplicationSettingsStore().canPostNews);
const { isNew, markRead } = useNewsReadState();

const lead = computed(() => articles.value[0] ?? null);
const rest = computed(() => articles.value.slice(1));
const hasMore = computed(() => articles.value.length < total.value);
const hasUnread = computed(() =>
  articles.value.some((article) => isNew(article.published_at)),
);

const published = { status: { _eq: "published" } };

const fetchCount = async () => {
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      news_articles_aggregate: [
        { where: published },
        { aggregate: { count: true } },
      ],
    }),
    fetchPolicy: "network-only",
  });
  total.value = (
    data as { news_articles_aggregate: { aggregate: { count: number } } }
  ).news_articles_aggregate.aggregate.count;
};

const fetchPage = async (offset: number, limit: number) => {
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      news_articles: [
        {
          where: published,
          order_by: [{ published_at: order_by.desc_nulls_last }],
          limit,
          offset,
        },
        newsArticleCardFields,
      ],
    }),
    fetchPolicy: "network-only",
  });
  return (data as { news_articles: NewsCardArticle[] }).news_articles;
};

const fetchArticles = async () => {
  loading.value = true;
  try {
    const [page] = await Promise.all([fetchPage(0, FIRST_PAGE), fetchCount()]);
    articles.value = page;
  } finally {
    loading.value = false;
  }
};

const loadMore = async () => {
  loadingMore.value = true;
  try {
    const page = await fetchPage(articles.value.length, MORE_PAGE);
    articles.value = [...articles.value, ...page];
  } finally {
    loadingMore.value = false;
  }
};

// Drafts and view counts exist only on the authors' admin action; the public
// table never exposes either.
const fetchAuthorPosts = async () => {
  if (!canPostNews.value) {
    drafts.value = [];
    viewCounts.value = {};
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        newsPostsAdmin: {
          id: true,
          title: true,
          status: true,
          updated_at: true,
          view_count: true,
        },
      }),
      fetchPolicy: "network-only",
    });
    const posts =
      (data as { newsPostsAdmin: NewsDraft[] }).newsPostsAdmin ?? [];
    drafts.value = posts.filter((post) => post.status !== "published");
    viewCounts.value = Object.fromEntries(
      posts.map((post) => [post.id, post.view_count]),
    );
  } catch {
    drafts.value = [];
    viewCounts.value = {};
  }
};

const publishDraft = async (draft: NewsDraft) => {
  publishing.value = draft.id;
  try {
    await getGraphqlClient().mutate({
      mutation: generateMutation({
        setNewsPostStatus: [
          { id: draft.id, status: "published" },
          { id: true },
        ],
      }),
    });
    toast({ title: useNuxtApp().$i18n.t("pages.news.manage.published_toast") });
    await Promise.all([fetchAuthorPosts(), fetchArticles()]);
  } finally {
    publishing.value = null;
  }
};

const viewsOf = (article: NewsCardArticle) =>
  canPostNews.value ? (viewCounts.value[article.id] ?? null) : null;

watch(canPostNews, () => fetchAuthorPosts());

onMounted(() => {
  if (!newsEnabled.value) {
    navigateTo("/");
    return;
  }
  fetchArticles();
  fetchAuthorPosts();
});
</script>

<template>
  <h1 class="sr-only">{{ newsLabel || $t("pages.news.title") }}</h1>

  <PageTransition>
    <div class="grid gap-6">
      <div
        v-if="hasUnread || canPostNews"
        class="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2"
      >
        <p
          v-if="hasUnread"
          class="m-0 inline-flex items-center gap-2 text-[0.8125rem] text-foreground/85"
        >
          <span
            aria-hidden="true"
            class="h-[7px] w-[7px] rounded-full bg-[hsl(var(--tac-amber))]"
          ></span>
          {{ $t("pages.news.new_since_visit") }}
          <button
            type="button"
            class="relative text-muted-foreground underline underline-offset-[3px] transition-colors duration-150 after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="markRead()"
          >
            {{ $t("pages.news.mark_read") }}
          </button>
        </p>
        <Button
          v-if="canPostNews"
          as-child
          size="sm"
          :class="['ml-auto', listCreateButtonClasses]"
        >
          <NuxtLink
            to="/news/manage/new"
            :title="$t('pages.news.manage.new_post')"
          >
            <PlusCircle class="h-4 w-4" />
            <span class="max-md:sr-only">
              {{ $t("pages.news.manage.new_post") }}
            </span>
          </NuxtLink>
        </Button>
      </div>

      <NewsDrafts
        v-if="drafts.length"
        :drafts="drafts"
        :publishing="publishing"
        @publish="publishDraft"
      />

      <FadeSwap>
        <div v-if="skeleton" key="loading" class="grid gap-9" aria-busy="true">
          <div
            class="grid overflow-hidden rounded-xl border border-border lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
          >
            <Skeleton class="aspect-video w-full rounded-none" />
            <div class="grid content-start gap-3 p-4 sm:p-6">
              <Skeleton class="h-4 w-40" />
              <Skeleton class="h-8 w-4/5" />
              <Skeleton class="h-16 w-full" />
              <Skeleton class="h-28 w-3/5" />
            </div>
          </div>
          <div
            class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div v-for="n in 3" :key="n" class="grid gap-2.5">
              <Skeleton class="aspect-video w-full rounded-lg" />
              <Skeleton class="h-4 w-28" />
              <Skeleton class="h-5 w-3/4" />
            </div>
          </div>
        </div>

        <SectionEmpty
          v-else-if="loaded && !lead"
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
              {{ $t("pages.news.write_first") }}
            </NuxtLink>
          </Button>
        </SectionEmpty>

        <div
          v-else-if="lead"
          key="list"
          class="grid gap-9 transition-opacity duration-200"
          :class="refreshing && 'pointer-events-none opacity-50'"
        >
          <NewsLead
            :article="lead"
            :is-new="isNew(lead.published_at)"
            :views="viewsOf(lead)"
          />

          <section v-if="rest.length" class="grid gap-3.5">
            <h2 :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.news.earlier") }}
            </h2>
            <div
              class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              <NewsCard
                v-for="article in rest"
                :key="article.id"
                :article="article"
                :is-new="isNew(article.published_at)"
                :views="viewsOf(article)"
              />
            </div>
          </section>

          <div v-if="hasMore" class="flex justify-center">
            <Button variant="outline" :loading="loadingMore" @click="loadMore">
              {{ $t("pages.news.show_older") }}
            </Button>
          </div>
        </div>
      </FadeSwap>
    </div>
  </PageTransition>
</template>
