<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Plus, Trash2, Send, Undo2, Newspaper, Eye } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery, generateMutation } from "~/graphql/graphqlGen";
import { newsPostAdminFields } from "~/graphql/newsGraphql";

interface NewsPost {
  id: string;
  slug: string;
  title: string;
  status: string;
  cover_image_url: string | null;
  published_at: string | null;
  updated_at: string;
  view_count: string;
}

const posts = ref<NewsPost[]>([]);
const loading = ref(true);
const deleteTarget = ref<NewsPost | null>(null);

const canPostNews = computed(() => useApplicationSettingsStore().canPostNews);

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

const fetchPosts = async () => {
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        newsPostsAdmin: newsPostAdminFields,
      }),
      fetchPolicy: "network-only",
    });
    posts.value = (data as { newsPostsAdmin: NewsPost[] }).newsPostsAdmin ?? [];
  } finally {
    loading.value = false;
  }
};

const setStatus = async (post: NewsPost, status: "draft" | "published") => {
  await getGraphqlClient().mutate({
    mutation: generateMutation({
      setNewsPostStatus: [{ id: post.id, status }, { id: true }],
    }),
  });
  toast({
    title:
      status === "published"
        ? useNuxtApp().$i18n.t("pages.news.manage.published_toast")
        : useNuxtApp().$i18n.t("pages.news.manage.unpublished_toast"),
  });
  await fetchPosts();
};

const confirmDelete = async () => {
  const post = deleteTarget.value;
  deleteTarget.value = null;
  if (!post) {
    return;
  }
  await getGraphqlClient().mutate({
    mutation: generateMutation({
      deleteNewsPost: [{ id: post.id }, { success: true }],
    }),
  });
  toast({ title: useNuxtApp().$i18n.t("pages.news.manage.deleted") });
  await fetchPosts();
};

onMounted(() => {
  if (!canPostNews.value) {
    navigateTo("/news");
    return;
  }
  fetchPosts();
});
</script>

<template>
  <PageTransition>
    <TacticalPageHeader corners="both">
      <template #title>{{ $t("pages.news.manage.title") }}</template>
      <template #actions>
        <NuxtLink to="/news">
          <Button variant="outline" class="gap-2">
            <Newspaper class="h-4 w-4" />
            {{ $t("pages.news.manage.view_news") }}
          </Button>
        </NuxtLink>
        <NuxtLink to="/news/manage/new">
          <Button class="gap-2">
            <Plus class="h-4 w-4" />
            {{ $t("pages.news.manage.new_post") }}
          </Button>
        </NuxtLink>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <div class="space-y-6">
    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="n in 4" :key="n" class="h-20 w-full rounded-lg" />
    </div>

    <div
      v-else-if="posts.length === 0"
      class="rounded-lg border border-dashed border-border/60 p-12 text-center text-muted-foreground"
    >
      {{ $t("pages.news.manage.empty") }}
    </div>

    <div v-else class="space-y-2">
      <NuxtLink
        v-for="post in posts"
        :key="post.id"
        :to="`/news/manage/${post.id}`"
        class="group block"
      >
        <Card
          variant="gradient"
          class="flex items-center gap-4 p-3 transition-colors hover:border-[hsl(var(--tac-amber)/0.5)]"
        >
          <div
            class="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded border border-border/50 bg-background/60"
          >
            <img
              v-if="post.cover_image_url"
              :src="post.cover_image_url"
              :alt="post.title"
              loading="lazy"
              referrerpolicy="no-referrer"
              class="h-full w-full object-cover"
            />
            <Newspaper v-else class="h-5 w-5 text-muted-foreground/50" />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.16em]"
                :class="
                  post.status === 'published'
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="
                    post.status === 'published'
                      ? 'bg-[hsl(var(--tac-amber))]'
                      : 'bg-muted-foreground/50'
                  "
                />
                {{
                  post.status === "published"
                    ? $t("pages.news.manage.published")
                    : $t("pages.news.manage.draft")
                }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ formatDate(post.published_at || post.updated_at) }}
              </span>
              <span
                class="inline-flex items-center gap-1 text-xs text-muted-foreground"
                :title="$t('pages.news.manage.views')"
              >
                <Eye class="h-3.5 w-3.5" />
                {{ Number(post.view_count || 0).toLocaleString() }}
              </span>
            </div>
            <p
              class="mt-1 truncate font-semibold transition-colors group-hover:text-[hsl(var(--tac-amber))]"
            >
              {{ post.title }}
            </p>
          </div>

          <div
            class="flex shrink-0 items-center gap-1"
            @click.stop.prevent
          >
            <Button
              v-if="post.status === 'published'"
              variant="ghost"
              size="sm"
              class="gap-1"
              @click="() => setStatus(post, 'draft')"
            >
              <Undo2 class="h-4 w-4" />
              <span class="hidden sm:inline">
                {{ $t("pages.news.manage.unpublish") }}
              </span>
            </Button>
            <Button
              v-else
              variant="ghost"
              size="sm"
              class="gap-1"
              @click="() => setStatus(post, 'published')"
            >
              <Send class="h-4 w-4" />
              <span class="hidden sm:inline">
                {{ $t("pages.news.manage.publish") }}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 text-muted-foreground hover:text-destructive"
              @click="deleteTarget = post"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </NuxtLink>
    </div>
    </div>
  </PageTransition>

  <AlertDialog
    :open="!!deleteTarget"
      @update:open="(open) => { if (!open) deleteTarget = null; }"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("pages.news.manage.delete_confirm_title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("pages.news.manage.delete_confirm_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete">
            {{ $t("pages.news.manage.delete") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
</template>
