<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import DOMPurify from "dompurify";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ArrowLeft, ExternalLink } from "lucide-vue-next";
import NewsCredit from "~/components/news/NewsCredit.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { newsArticleFields } from "~/graphql/newsGraphql";

interface NewsArticle {
  id: string;
  issue_number: number | null;
  slug: string | null;
  url: string;
  title: string;
  teaser: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  author: string | null;
  published_at: string | null;
}

const route = useRoute();
const slug = computed(() => String(route.params.slug));

const article = ref<NewsArticle | null>(null);
const loading = ref(true);

const tldrNewsEnabled = computed(
  () => useApplicationSettingsStore().tldrNewsEnabled,
);

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

const hasFullContent = computed(() => !!article.value?.content_html);

// Email HTML is built for a fixed desktop design width; render it at that
// width and scale the whole block down to fit the viewport so layout and
// image proportions stay intact on mobile (transform-scale fit pattern).
const DESIGN_WIDTH = 600;
const frameRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const scale = ref(1);
const offsetX = ref(0);
const frameHeight = ref<number | null>(null);
let resizeObserver: ResizeObserver | null = null;

const fit = () => {
  const frame = frameRef.value;
  const content = contentRef.value;
  if (!frame || !content) {
    return;
  }
  const available = frame.clientWidth;
  const next = Math.min(1, available / DESIGN_WIDTH);
  scale.value = next;
  // scrollHeight is the unscaled layout height (transform doesn't affect it)
  frameHeight.value = content.scrollHeight * next;
  offsetX.value = Math.max(0, (available - DESIGN_WIDTH * next) / 2);
};

const setupFit = () => {
  if (!import.meta.client) {
    return;
  }
  resizeObserver?.disconnect();
  resizeObserver = new ResizeObserver(() => fit());
  if (frameRef.value) {
    resizeObserver.observe(frameRef.value);
  }
  // observing the content refits as images load and height grows
  if (contentRef.value) {
    resizeObserver.observe(contentRef.value);
  }
  fit();
};

onBeforeUnmount(() => resizeObserver?.disconnect());

const renderedContent = computed(() => {
  if (!import.meta.client || !article.value?.content_html) {
    return "";
  }
  const clean = DOMPurify.sanitize(article.value.content_html, {
    ADD_ATTR: ["target", "align", "valign", "bgcolor", "width", "height"],
  });
  return clean.replace(
    /<a (?![^>]*\btarget=)/g,
    '<a target="_blank" rel="noopener noreferrer" ',
  );
});

watch(renderedContent, async () => {
  await nextTick();
  setupFit();
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
  if (!tldrNewsEnabled.value) {
    navigateTo("/");
    return;
  }
  fetchArticle();
});
</script>

<template>
  <div class="container mx-auto max-w-3xl space-y-6 p-4">
    <NuxtLink to="/news">
      <Button variant="ghost" size="sm" class="gap-1">
        <ArrowLeft class="h-4 w-4" />
        {{ $t("pages.news.back") }}
      </Button>
    </NuxtLink>

    <template v-if="loading">
      <Skeleton class="h-24 w-full rounded-lg" />
      <Skeleton class="h-96 w-full rounded-lg" />
    </template>

    <template v-else-if="article">
      <header class="space-y-3">
        <div class="space-y-1.5">
          <span
            class="inline-flex flex-wrap items-center gap-x-2 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            <span class="text-[0.7rem] text-[hsl(var(--tac-amber))]">◢</span>
            <span v-if="article.issue_number">
              {{ $t("pages.news.issue", { number: article.issue_number }) }}
            </span>
            <span v-if="article.published_at">
              · {{ formatDate(article.published_at) }}
            </span>
          </span>
          <h1
            class="text-balance font-sans text-2xl font-bold uppercase leading-tight tracking-[0.02em] text-foreground sm:text-3xl"
          >
            {{ article.title }}
          </h1>
        </div>
        <NewsCredit />
      </header>

      <div v-if="hasFullContent" class="news-frame">
        <ClientOnly>
          <div
            ref="frameRef"
            class="news-frame__viewport"
            :style="{ height: frameHeight ? `${frameHeight}px` : undefined }"
          >
            <div
              ref="contentRef"
              class="news-frame__email"
              :class="{ 'is-scaled': scale < 0.999 }"
              :style="{
                width: `${DESIGN_WIDTH}px`,
                left: `${offsetX}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                '--news-scale': scale,
              }"
              v-html="renderedContent"
            />
          </div>
          <template #fallback>
            <p class="text-muted-foreground">{{ article.teaser }}</p>
          </template>
        </ClientOnly>
      </div>

      <div v-else class="space-y-4">
        <p v-if="article.teaser" class="text-lg text-muted-foreground">
          {{ article.teaser }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{ $t("pages.news.preview_notice") }}
        </p>
        <a :href="article.url" target="_blank" rel="noopener noreferrer">
          <Button class="gap-2">
            {{ $t("pages.news.read_full_on_tldr") }}
            <ExternalLink class="h-4 w-4" />
          </Button>
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.news-frame__viewport {
  position: relative;
  width: 100%;
  overflow: hidden;
}
.news-frame__email {
  position: absolute;
  top: 0;
  /* width / left / transform are set inline by the fit() logic */
}
.news-frame__email :deep(.f) {
  display: none;
}
.news-frame__email :deep(*) {
  font-family: inherit !important;
  color: hsl(var(--foreground)) !important;
  /* safety net: an element wider than the design width would spill past the
     scaled box; cap it to the 600px frame (faithful widths are preserved) */
  max-width: 100% !important;
}
.news-frame__email :deep(a) {
  color: hsl(var(--primary)) !important;
}
/* When the email is scaled down to fit a phone, uniform scaling makes text
   tiny. Enlarge text at the design stage by the inverse of the scale so it
   lands at a readable size after the transform; images/layout are untouched.
   Gated behind .is-scaled so the desktop (scale 1) rendering stays faithful. */
.news-frame__email.is-scaled :deep(p),
.news-frame__email.is-scaled :deep(li),
.news-frame__email.is-scaled :deep(td),
.news-frame__email.is-scaled :deep(th),
.news-frame__email.is-scaled :deep(span),
.news-frame__email.is-scaled :deep(a) {
  font-size: calc(15px / var(--news-scale, 1)) !important;
  line-height: 1.45 !important;
}
.news-frame__email.is-scaled :deep(h1) {
  font-size: calc(26px / var(--news-scale, 1)) !important;
}
.news-frame__email.is-scaled :deep(h2) {
  font-size: calc(22px / var(--news-scale, 1)) !important;
}
.news-frame__email.is-scaled :deep(h3) {
  font-size: calc(19px / var(--news-scale, 1)) !important;
}
.news-frame__email.is-scaled :deep(h4) {
  font-size: calc(17px / var(--news-scale, 1)) !important;
}
.news-frame__email :deep([style*="background-color:#FFFFFF"]),
.news-frame__email :deep([style*="background-color: #FFFFFF"]),
.news-frame__email :deep([style*="background-color:#ffffff"]),
.news-frame__email :deep([bgcolor="#FFFFFF"]),
.news-frame__email :deep([bgcolor="#ffffff"]) {
  background-color: transparent !important;
}
.news-frame__email :deep(.j) {
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}
.news-frame__email :deep([style*="#E9E9E9"]),
.news-frame__email :deep([style*="#e9e9e9"]) {
  border-color: rgba(255, 255, 255, 0.22) !important;
}
.news-frame__email :deep([style*="#ffda5b"]),
.news-frame__email :deep([style*="#ffda5b"] *),
.news-frame__email :deep([style*="#FFD633"]),
.news-frame__email :deep([style*="#FFD633"] *),
.news-frame__email :deep([style*="#ffedad"]),
.news-frame__email :deep([style*="#ffedad"] *),
.news-frame__email :deep([style*="#fff9e4"]),
.news-frame__email :deep([style*="#fff9e4"] *),
.news-frame__email :deep([bgcolor="#ffda5b"]),
.news-frame__email :deep([bgcolor="#ffda5b"] *) {
  color: #1a1a1a !important;
}
.news-frame__email :deep(img),
.news-frame__email :deep(video) {
  max-width: 100% !important;
  height: auto !important;
}
/* keep tables within the design frame; their own widths are preserved */
.news-frame__email :deep(table) {
  max-width: 100% !important;
}
</style>
