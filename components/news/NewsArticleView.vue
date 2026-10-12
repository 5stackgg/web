<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronDown, TableOfContents } from "lucide-vue-next";
import NewsPoster from "~/components/news/NewsPoster.vue";
import NewsStatusLine from "~/components/news/NewsStatusLine.vue";
import NewsToc from "~/components/news/NewsToc.vue";
import { renderNewsArticle } from "~/utilities/newsMarkdown";
import { useNewsShare } from "~/composables/useNewsShare";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

/**
 * A full news post: the cover on top of one header surface (status line,
 * title, teaser, then whatever the page puts in the byline and actions slots),
 * the body beside a contents rail that follows the reader, and the closing
 * call to action as its own block. Shared by the post page and the editor's
 * full preview, so a draft looks exactly like what readers will get.
 *
 * In-page links scroll instead of changing the URL: the page key includes the
 * hash, so letting the router see one would remount the whole post.
 */
const props = defineProps<{
  title: string;
  teaser?: string | null;
  coverImageUrl?: string | null;
  contentMarkdown?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  views?: string | number | null;
  slug?: string | null;
  initialSection?: string | null;
}>();

const { t } = useI18n();
const { copyNewsLink } = useNewsShare();

const rendered = computed(() =>
  renderNewsArticle(props.contentMarkdown, {
    anchorLabel: t("pages.news.section_link"),
  }),
);
const sections = computed(() => rendered.value.sections);

const prose = ref<HTMLElement | null>(null);
const mobileToc = ref<HTMLDetailsElement | null>(null);
const active = ref(0);
let observer: IntersectionObserver | null = null;

const headings = () =>
  prose.value
    ? Array.from(prose.value.querySelectorAll<HTMLElement>("h3[id]"))
    : [];

function track() {
  observer?.disconnect();
  observer = null;
  const list = headings();
  active.value = 0;
  if (!list.length || !("IntersectionObserver" in window)) {
    return;
  }
  // The section being read is the last heading above the top third of the screen.
  observer = new IntersectionObserver(
    () => {
      const line = window.innerHeight * 0.35;
      let current = 0;
      list.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top < line) {
          current = index;
        }
      });
      active.value = current;
    },
    { rootMargin: "0px 0px -60% 0px", threshold: [0, 1] },
  );
  list.forEach((heading) => observer?.observe(heading));
}

function scrollToHeading(target: HTMLElement | undefined, smooth = true) {
  if (!target) {
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({
    behavior: smooth && !reduce ? "smooth" : "auto",
    block: "start",
  });
}

function select(index: number) {
  active.value = index;
  scrollToHeading(headings()[index]);
  if (mobileToc.value) {
    mobileToc.value.open = false;
  }
}

function onProseClick(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
    'a[href^="#"]',
  );
  if (!link || !prose.value) {
    return;
  }
  event.preventDefault();
  const id = decodeURIComponent(link.getAttribute("href")!.slice(1));
  // The # beside a heading copies a link to that section.
  if (link.classList.contains("news-anchor") && props.slug) {
    copyNewsLink(props.slug, id);
    return;
  }
  scrollToHeading(
    prose.value.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) ??
      undefined,
  );
}

watch(
  [prose, () => rendered.value.html],
  async ([element]) => {
    if (!element) {
      return;
    }
    await nextTick();
    track();
    if (props.initialSection) {
      const index = sections.value.findIndex(
        (section) => section.id === props.initialSection,
      );
      if (index > -1) {
        active.value = index;
        scrollToHeading(headings()[index], false);
      }
    }
  },
  { flush: "post" },
);

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <article>
    <header
      class="overflow-hidden rounded-2xl border border-border bg-muted/20"
      :class="
        !coverImageUrl &&
        'bg-[radial-gradient(90%_140%_at_50%_-40%,hsl(var(--tac-amber)/0.12),transparent_60%)]'
      "
    >
      <div
        v-if="coverImageUrl"
        class="relative isolate flex max-h-[30rem] justify-center overflow-hidden border-b border-border bg-black"
      >
        <!-- Only shows when the area is wider than the poster at its height cap. -->
        <img
          :src="coverImageUrl"
          alt=""
          aria-hidden="true"
          referrerpolicy="no-referrer"
          class="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-70 blur-2xl brightness-[0.45] saturate-125"
        />
        <NewsPoster
          :src="coverImageUrl"
          :alt="title"
          :rounded="false"
          eager
          class="w-full max-w-[53.333rem] !bg-transparent !shadow-none"
        />
      </div>
      <div
        v-else
        aria-hidden="true"
        class="h-1 bg-[linear-gradient(90deg,transparent,hsl(var(--tac-amber)/0.55)_30%,hsl(var(--tac-amber)/0.55)_70%,transparent)]"
      ></div>

      <div
        class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-4 pb-5 pt-4 sm:px-6 sm:pt-5"
      >
        <div class="grid min-w-0 flex-[1_1_32rem] gap-2.5">
          <NewsStatusLine
            :published-at="publishedAt"
            :minutes="rendered.minutes"
            :updated-at="updatedAt"
            :views="views"
          />
          <h1
            class="m-0 text-[clamp(1.75rem,3.2vw,2.625rem)] font-extrabold leading-[1.05] tracking-[0.005em] [text-wrap:balance]"
          >
            {{ title || $t("pages.news.form.title_placeholder") }}
          </h1>
          <p
            v-if="teaser"
            class="m-0 max-w-[68ch] text-base leading-relaxed text-foreground/80 [text-wrap:pretty]"
          >
            {{ teaser }}
          </p>
        </div>
        <div
          v-if="$slots.byline || $slots.actions"
          class="flex flex-wrap items-center gap-x-3.5 gap-y-2.5"
        >
          <slot name="byline" />
          <div v-if="$slots.actions" class="flex flex-wrap gap-2">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </header>

    <div
      class="mx-auto mt-8 grid max-w-[66rem] gap-12"
      :class="sections.length ? 'lg:grid-cols-[minmax(0,1fr)_15rem]' : ''"
    >
      <div class="min-w-0">
        <details
          v-if="sections.length"
          ref="mobileToc"
          class="group/toc mb-6 lg:hidden"
        >
          <summary
            class="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-muted/25 px-3 text-[0.8125rem] font-semibold [&::-webkit-details-marker]:hidden"
          >
            <TableOfContents class="h-3.5 w-3.5 text-muted-foreground" />
            {{ $t("pages.news.on_this_page") }}
            <ChevronDown
              class="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-open/toc:rotate-180"
            />
          </summary>
          <nav :aria-label="$t('pages.news.on_this_page')" class="mt-2 pl-0.5">
            <NewsToc :sections="sections" :active="active" @select="select" />
          </nav>
        </details>

        <ClientOnly>
          <template v-if="contentMarkdown">
            <div
              ref="prose"
              class="news-content"
              @click="onProseClick"
              v-html="rendered.html"
            />
            <aside
              v-if="rendered.closingHtml"
              class="news-closing"
              v-html="rendered.closingHtml"
            />
          </template>
          <p v-else class="text-muted-foreground">
            {{ $t("pages.news.form.preview_empty") }}
          </p>
          <template #fallback>
            <p class="text-muted-foreground">{{ teaser }}</p>
          </template>
        </ClientOnly>
      </div>

      <aside v-if="sections.length" class="hidden lg:block">
        <nav
          :aria-label="$t('pages.news.on_this_page')"
          class="sticky top-6 grid gap-2.5"
        >
          <p :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.news.on_this_page") }}
          </p>
          <NewsToc :sections="sections" :active="active" @select="select" />
        </nav>
      </aside>
    </div>

    <slot name="footer" />
  </article>
</template>
