<script setup lang="ts">
import { computed } from "vue";
import { Newspaper, X } from "lucide-vue-next";

const article = computed(() => useNotificationStore().unreadNewsArticle);

const to = computed(() => {
  const a = article.value;
  return a?.slug ? `/news/${a.slug}` : "/news";
});

const markRead = () => {
  useNotificationStore().markNewsRead();
};
</script>

<template>
  <div
    v-if="article"
    class="mb-3 overflow-hidden rounded-md border border-border bg-card/60"
  >
    <NuxtLink
      :to="to"
      class="block transition-colors hover:bg-accent/40"
      @click="markRead"
    >
      <div
        v-if="article.cover_image_url"
        class="aspect-video w-full overflow-hidden bg-muted"
      >
        <img
          :src="article.cover_image_url"
          :alt="article.title"
          loading="lazy"
          referrerpolicy="no-referrer"
          class="h-full w-full object-cover"
        />
      </div>
      <div class="flex items-start gap-2 p-3">
        <Newspaper
          class="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
        />
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center justify-between gap-2">
            <span
              class="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ $t("pages.news.new_article") }}
            </span>
            <button
              type="button"
              :aria-label="$t('pages.news.mark_read')"
              class="text-muted-foreground transition-colors hover:text-foreground"
              @click.prevent.stop="markRead"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
          <p class="text-sm font-semibold leading-snug text-foreground">
            {{ article.title }}
          </p>
          <p
            v-if="article.teaser"
            class="line-clamp-2 text-xs text-muted-foreground"
          >
            {{ article.teaser }}
          </p>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>
