<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import MarkdownEditor from "~/components/news/MarkdownEditor.vue";
import NewsCoverEditor from "~/components/news/NewsCoverEditor.vue";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Image as ImageIcon,
  Send,
  Undo2,
} from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery, generateMutation } from "~/graphql/graphqlGen";
import { newsPostAdminFields } from "~/graphql/newsGraphql";

interface NewsPost {
  id: string;
  slug: string;
  title: string;
  teaser: string | null;
  cover_image_url: string | null;
  content_markdown: string;
  status: string;
}

const route = useRoute();
const isNew = computed(() => route.params.id === "new");

const loading = ref(!isNew.value);
const id = ref<string | null>(isNew.value ? null : String(route.params.id));
const status = ref<string>("draft");
const title = ref("");
const teaser = ref("");
const coverImageUrl = ref<string | null>(null);
const content = ref("");

const coverInput = ref<HTMLInputElement | null>(null);
const { accept: ACCEPT } = useNewsImageUpload();
const coverEditorOpen = ref(false);
const coverEditorFile = ref<File | null>(null);

const canPostNews = computed(() => useApplicationSettingsStore().canPostNews);
const saving = ref(false);

const fetchPost = async () => {
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        newsPostAdmin: [{ id: id.value }, newsPostAdminFields],
      }),
      fetchPolicy: "network-only",
    });
    const post = (data as { newsPostAdmin: NewsPost | null }).newsPostAdmin;
    if (!post) {
      return navigateTo("/news/manage");
    }
    title.value = post.title;
    teaser.value = post.teaser ?? "";
    coverImageUrl.value = post.cover_image_url;
    content.value = post.content_markdown ?? "";
    status.value = post.status;
  } finally {
    loading.value = false;
  }
};

const save = async (): Promise<NewsPost | null> => {
  if (!title.value.trim()) {
    toast({
      title: useNuxtApp().$i18n.t("pages.news.form.title_label"),
      variant: "destructive",
    });
    return null;
  }
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: generateMutation({
        saveNewsPost: [
          {
            id: id.value,
            title: title.value.trim(),
            teaser: teaser.value.trim() || null,
            cover_image_url: coverImageUrl.value,
            content_markdown: content.value,
          },
          newsPostAdminFields,
        ],
      }),
    });
    const post = (data as { saveNewsPost: NewsPost }).saveNewsPost;
    id.value = post.id;
    status.value = post.status;
    toast({ title: useNuxtApp().$i18n.t("pages.news.manage.saved") });
    return post;
  } catch (error: any) {
    toast({
      title: useNuxtApp().$i18n.t("pages.news.manage.save_failed"),
      description: error?.message,
      variant: "destructive",
    });
    return null;
  }
};

const setStatus = async (postId: string, next: "draft" | "published") => {
  await getGraphqlClient().mutate({
    mutation: generateMutation({
      setNewsPostStatus: [{ id: postId, status: next }, { id: true }],
    }),
  });
};

const saveChanges = async () => {
  if (saving.value) {
    return;
  }
  saving.value = true;
  try {
    const post = await save();
    if (post && isNew.value) {
      navigateTo(`/news/manage/${post.id}`);
    }
  } finally {
    saving.value = false;
  }
};

const publish = async () => {
  if (saving.value) {
    return;
  }
  saving.value = true;
  try {
    const post = await save();
    if (!post) {
      return;
    }
    await setStatus(post.id, "published");
    toast({ title: useNuxtApp().$i18n.t("pages.news.manage.published_toast") });
    navigateTo("/news/manage");
  } finally {
    saving.value = false;
  }
};

const unpublish = async () => {
  if (saving.value) {
    return;
  }
  saving.value = true;
  try {
    const post = await save();
    if (!post) {
      return;
    }
    await setStatus(post.id, "draft");
    status.value = "draft";
    toast({ title: useNuxtApp().$i18n.t("pages.news.manage.unpublished_toast") });
  } finally {
    saving.value = false;
  }
};

const triggerCoverPicker = () => {
  coverInput.value?.click();
};

const openCoverEditor = (file: File) => {
  coverEditorFile.value = file;
  coverEditorOpen.value = true;
};

const onCoverSelected = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) {
    openCoverEditor(file);
  }
};

const onCoverDrop = (event: DragEvent) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    openCoverEditor(file);
  }
};

const onCoverUploaded = (url: string) => {
  coverImageUrl.value = url;
};

onMounted(() => {
  if (!canPostNews.value) {
    navigateTo("/news");
    return;
  }
  if (!isNew.value) {
    fetchPost();
  }
});
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex items-center justify-between">
      <NuxtLink to="/news/manage">
        <Button variant="ghost" size="sm" class="gap-1">
          <ArrowLeft class="h-4 w-4" />
          {{ $t("pages.news.manage.title") }}
        </Button>
      </NuxtLink>
      <span
        v-if="!loading"
        class="inline-flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.16em]"
        :class="
          status === 'published'
            ? 'text-[hsl(var(--tac-amber))]'
            : 'text-muted-foreground'
        "
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="
            status === 'published'
              ? 'bg-[hsl(var(--tac-amber))]'
              : 'bg-muted-foreground/50'
          "
        />
        {{
          status === "published"
            ? $t("pages.news.manage.published")
            : $t("pages.news.manage.draft")
        }}
      </span>
    </div>

    <template v-if="loading">
      <Skeleton class="h-12 w-full rounded-lg" />
      <Skeleton class="h-96 w-full rounded-lg" />
    </template>

    <template v-else>
      <div class="space-y-2">
        <Label>{{ $t("pages.news.form.title_label") }}</Label>
        <Input
          v-model="title"
          class="h-auto py-2.5 text-lg font-semibold"
          :placeholder="$t('pages.news.form.title_placeholder')"
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside class="space-y-6">
          <div class="space-y-2">
            <Label>{{ $t("pages.news.form.teaser_label") }}</Label>
            <textarea
              v-model="teaser"
              rows="3"
              class="w-full resize-y rounded-md border border-input bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              :placeholder="$t('pages.news.form.teaser_placeholder')"
            />
          </div>

          <div class="space-y-2">
            <Label>{{ $t("pages.news.form.cover_label") }}</Label>
            <input
              ref="coverInput"
              type="file"
              class="hidden"
              :accept="ACCEPT"
              @change="onCoverSelected"
            />
            <div
              role="button"
              tabindex="0"
              class="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border/60 bg-background/40 transition-colors hover:border-[hsl(var(--tac-amber)/0.5)]"
              @click="triggerCoverPicker"
              @keydown.enter.prevent="triggerCoverPicker"
              @dragover.prevent
              @drop.prevent="onCoverDrop"
            >
              <img
                v-if="coverImageUrl"
                :src="coverImageUrl"
                alt=""
                referrerpolicy="no-referrer"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex flex-col items-center gap-2 px-4 text-center text-muted-foreground"
              >
                <ImageIcon class="h-7 w-7" />
                <span class="text-sm">
                  {{ $t("pages.news.form.cover_hint") }}
                </span>
                <span
                  class="text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground/60"
                >
                  {{ $t("pages.news.form.cover_formats") }}
                </span>
              </div>

              <div
                v-if="coverImageUrl"
                class="absolute right-2 top-2 flex gap-1.5"
                @click.stop.prevent
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  class="h-7 w-7"
                  :title="$t('pages.news.form.cover_replace')"
                  @click="triggerCoverPicker"
                >
                  <Upload class="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  class="h-7 w-7 text-destructive"
                  :title="$t('pages.news.form.cover_remove')"
                  @click="coverImageUrl = null"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <div class="min-w-0 space-y-2">
          <Label>{{ $t("pages.news.form.content_label") }}</Label>
          <MarkdownEditor v-model="content" />
        </div>
      </div>

      <div
        class="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-background/80 px-1 py-3 backdrop-blur"
      >
        <template v-if="status === 'published'">
          <Button
            variant="outline"
            class="gap-2"
            :disabled="saving"
            @click="unpublish"
          >
            <Undo2 class="h-4 w-4" />
            {{ $t("pages.news.manage.unpublish") }}
          </Button>
          <Button class="gap-2" :loading="saving" @click="saveChanges">
            {{ $t("pages.news.form.save_changes") }}
          </Button>
        </template>
        <template v-else>
          <Button
            variant="outline"
            :disabled="saving"
            @click="saveChanges"
          >
            {{ $t("pages.news.form.save_draft") }}
          </Button>
          <Button class="gap-2" :loading="saving" @click="publish">
            <Send class="h-4 w-4" />
            {{ $t("pages.news.form.publish") }}
          </Button>
        </template>
      </div>
    </template>

    <NewsCoverEditor
      v-model:open="coverEditorOpen"
      :file="coverEditorFile"
      @uploaded="onCoverUploaded"
    />
  </div>
</template>
