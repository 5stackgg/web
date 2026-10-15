<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { LogIn, RefreshCw, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { FadeSwap } from "~/components/ui/transitions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import AnimatedStat from "~/components/AnimatedStat.vue";
import NewsComment from "~/components/news/NewsComment.vue";
import NewsCommentComposer from "~/components/news/NewsCommentComposer.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useNewsComments } from "~/composables/useNewsComments";
import { useNewsShare } from "~/composables/useNewsShare";
import { schemaHasType } from "~/utilities/schemaHasType";
import { loginLinks } from "~/utilities/loginLinks";
import {
  NEWS_COMMENT_HIDE_REASON_MAX_LENGTH,
  NEWS_COMMENTS_PAGE,
  newsCommentErrorKey,
  newsCommentIdFromHash,
  newsCommentSanction,
  newsCommentsClosesAt,
  newsCommentsOpen,
  type NewsComment as Comment,
  type NewsCommentViewer,
} from "~/utilities/newsComments";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  articleId: string;
  slug: string | null;
  publishedAt: string | null;
}>();

const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const api = useNewsComments();
const { copyNewsLink } = useNewsShare();

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const MAX_REVEAL_PAGES = 10;

const available = ref(false);
const comments = ref<Comment[]>([]);
const limit = ref(NEWS_COMMENTS_PAGE);
const hasMore = ref(false);
const count = ref<number | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const failed = ref(false);
const now = ref(Date.now());
const replyingTo = ref<string | null>(null);
const editing = ref<string | null>(null);
const highlighted = ref<string | null>(null);
const votes = ref<
  Record<string, { vote_count: number; voted: boolean; busy: boolean }>
>({});

const hideTarget = ref<Comment | null>(null);
const hideReason = ref("");
const deleteTarget = ref<Comment | null>(null);
let moderating = false;

const steamId = computed(() =>
  auth.me?.steam_id ? String(auth.me.steam_id) : null,
);
const verified = computed(() =>
  auth.isRoleAbove(e_player_roles_enum.verified_user),
);
const staff = computed(() => auth.isRoleAbove(e_player_roles_enum.moderator));
const sanction = computed(() => newsCommentSanction(auth.me));
const open = computed(() => newsCommentsOpen(props.publishedAt, now.value));

const viewer = computed<NewsCommentViewer>(() => ({
  steamId: steamId.value,
  staff: staff.value,
  canWrite: open.value && verified.value && !sanction.value,
  canTakeBackVote: open.value && verified.value,
}));

const readOnly = computed(() => {
  if (!open.value) {
    return "closed";
  }
  if (!steamId.value) {
    return "sign_in";
  }
  if (!verified.value) {
    return "not_verified";
  }
  return sanction.value;
});

const openFor = computed(() => {
  const closesAt = newsCommentsClosesAt(props.publishedAt);
  if (closesAt === null) {
    return null;
  }
  const left = closesAt - now.value;
  if (left >= DAY) {
    return t("pages.news.comments.open_days", {
      count: Math.floor(left / DAY),
    });
  }
  return t("pages.news.comments.open_hours", {
    count: Math.max(1, Math.ceil(left / HOUR)),
  });
});

const hideOpen = computed({
  get: () => !!hideTarget.value,
  set: (value: boolean) => {
    if (!value) {
      hideTarget.value = null;
    }
  },
});

const deleteOpen = computed({
  get: () => !!deleteTarget.value,
  set: (value: boolean) => {
    if (!value) {
      deleteTarget.value = null;
    }
  },
});

let threads: { unsubscribe: () => void } | null = null;
let counter: { unsubscribe: () => void } | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let highlightTimer: ReturnType<typeof setTimeout> | null = null;
let revealing = newsCommentIdFromHash(route.hash);
let revealPages = 0;

function subscribe() {
  threads?.unsubscribe();
  counter?.unsubscribe();
  failed.value = false;

  threads = api.watchThreads(props.articleId, limit.value + 1, staff.value, {
    next: (rows) => {
      hasMore.value = rows.length > limit.value;
      comments.value = rows.slice(0, limit.value);
      votes.value = Object.fromEntries(
        Object.entries(votes.value).filter(([, vote]) => vote.busy),
      );
      loading.value = false;
      loadingMore.value = false;
      void reveal();
    },
    error: () => {
      failed.value = true;
      loading.value = false;
      loadingMore.value = false;
    },
  });

  counter = api.watchCount(props.articleId, {
    next: (value) => {
      count.value = value;
    },
    error: () => {
      count.value = null;
    },
  });
}

function retry() {
  loading.value = true;
  subscribe();
}

function showMore() {
  loadingMore.value = true;
  limit.value += NEWS_COMMENTS_PAGE;
  subscribe();
}

async function reveal() {
  const id = revealing;
  if (!id) {
    return;
  }

  const shown = comments.value.some(
    (comment) =>
      comment.id === id || comment.replies?.some((reply) => reply.id === id),
  );

  if (!shown) {
    if (hasMore.value && revealPages < MAX_REVEAL_PAGES) {
      revealPages++;
      showMore();
      return;
    }
    revealing = null;
    return;
  }

  revealing = null;
  highlighted.value = id;
  await nextTick();

  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  document
    .querySelector(`[data-comment-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });

  if (highlightTimer) {
    clearTimeout(highlightTimer);
  }
  highlightTimer = setTimeout(() => {
    highlighted.value = null;
  }, 2600);
}

function refusal(error: unknown) {
  const message =
    (error as { graphQLErrors?: Array<{ message?: string }> })
      ?.graphQLErrors?.[0]?.message ?? (error as Error)?.message;

  toast({
    variant: "destructive",
    title: t("pages.news.comments.errors.title"),
    description: t(newsCommentErrorKey(message)),
  });
}

async function postComment(body: string) {
  try {
    await api.post(props.articleId, body);
    return true;
  } catch (error) {
    refusal(error);
    return false;
  }
}

async function sendReply(comment: Comment, body: string) {
  try {
    await api.post(props.articleId, body, comment.id);
    replyingTo.value = null;
    return true;
  } catch (error) {
    refusal(error);
    return false;
  }
}

async function sendEdit(comment: Comment, body: string) {
  try {
    await api.edit(comment.id, body);
    editing.value = null;
    return true;
  } catch (error) {
    refusal(error);
    return false;
  }
}

async function vote(comment: Comment) {
  const current = votes.value[comment.id] ?? {
    vote_count: comment.vote_count,
    voted: comment.viewer_voted,
    busy: false,
  };
  if (current.busy) {
    return;
  }

  votes.value = {
    ...votes.value,
    [comment.id]: {
      vote_count: Math.max(0, current.vote_count + (current.voted ? -1 : 1)),
      voted: !current.voted,
      busy: true,
    },
  };

  try {
    const result = await api.toggleVote(comment.id);
    votes.value = {
      ...votes.value,
      [comment.id]: {
        vote_count: result.vote_count,
        voted: result.voted,
        busy: false,
      },
    };
  } catch (error) {
    votes.value = { ...votes.value, [comment.id]: { ...current, busy: false } };
    refusal(error);
  }
}

function startReply(comment: Comment) {
  editing.value = null;
  replyingTo.value = comment.id;
}

function startEdit(comment: Comment) {
  replyingTo.value = null;
  editing.value = comment.id;
}

function askHide(comment: Comment) {
  hideReason.value = "";
  hideTarget.value = comment;
}

async function moderate(work: () => Promise<unknown>) {
  if (moderating) {
    return;
  }
  moderating = true;
  try {
    await work();
  } catch (error) {
    refusal(error);
  } finally {
    moderating = false;
  }
}

async function confirmHide() {
  const comment = hideTarget.value;
  const reason = hideReason.value;
  if (!comment) {
    return;
  }
  await moderate(() => api.setHidden(comment.id, true, reason));
  hideTarget.value = null;
}

function restore(comment: Comment) {
  void moderate(() => api.setHidden(comment.id, false));
}

async function confirmDelete() {
  const comment = deleteTarget.value;
  if (!comment) {
    return;
  }
  await moderate(() => api.remove(comment.id));
  deleteTarget.value = null;
}

function copyLink(comment: Comment) {
  if (props.slug) {
    void copyNewsLink(props.slug, `comment-${comment.id}`);
  }
}

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

watch(staff, () => {
  if (available.value) {
    subscribe();
  }
});

onMounted(async () => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 30_000);

  available.value = await schemaHasType(getGraphqlClient(), "news_comments");
  if (available.value) {
    subscribe();
  }
});

onBeforeUnmount(() => {
  threads?.unsubscribe();
  counter?.unsubscribe();
  if (ticker) {
    clearInterval(ticker);
  }
  if (highlightTimer) {
    clearTimeout(highlightTimer);
  }
});
</script>

<template>
  <section
    v-if="available"
    id="news-comments"
    class="mx-auto mt-11 grid max-w-[66rem] scroll-mt-24 gap-4"
    :aria-label="$t('pages.news.comments.title')"
    data-testid="news-comments"
  >
    <h2 :class="[tacticalSectionLabelClasses, 'mb-0']">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("pages.news.comments.title") }}
      <span
        v-if="count !== null"
        class="font-mono text-[0.65rem] tabular-nums tracking-normal text-muted-foreground/70"
        data-testid="news-comments-count"
      >
        <AnimatedStat :value="count" />
      </span>
    </h2>

    <div class="grid max-w-[46rem] gap-4">
      <NewsCommentComposer
        v-if="!readOnly"
        :placeholder="$t('pages.news.comments.placeholder')"
        :submit-label="$t('pages.news.comments.post')"
        :hint="openFor"
        :cancellable="false"
        :send="postComment"
      />
      <div
        v-else-if="readOnly === 'sign_in'"
        class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2.5"
        data-testid="news-comments-sign-in"
      >
        <span class="text-xs text-muted-foreground">
          {{ $t("pages.news.comments.sign_in_prompt") }}
        </span>
        <Button variant="outline" size="sm" @click="signIn">
          <LogIn />
          {{ $t("pages.news.comments.sign_in") }}
        </Button>
      </div>
      <p
        v-else
        class="m-0 rounded-md border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground"
        data-testid="news-comments-read-only"
      >
        {{ $t(`pages.news.comments.read_only.${readOnly}`) }}
      </p>

      <FadeSwap>
        <div v-if="loading" key="loading" class="grid gap-3" aria-busy="true">
          <div
            v-for="row in 2"
            :key="row"
            class="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2"
          >
            <Skeleton
              class="row-span-2 h-8 w-8 motion-reduce:animate-none"
            />
            <Skeleton
              class="h-3.5 motion-reduce:animate-none"
              :class="row === 1 ? 'w-32' : 'w-24'"
            />
            <Skeleton
              class="h-4 motion-reduce:animate-none"
              :class="row === 1 ? 'w-4/5' : 'w-3/5'"
            />
          </div>
        </div>

        <div
          v-else-if="failed"
          key="failed"
          class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
          data-testid="news-comments-failed"
        >
          <span class="flex items-center gap-2 text-xs text-muted-foreground">
            <TriangleAlert
              class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            {{ $t("pages.news.comments.load_failed") }}
          </span>
          <Button variant="outline" size="sm" @click="retry">
            <RefreshCw />
            {{ $t("pages.news.comments.try_again") }}
          </Button>
        </div>

        <p
          v-else-if="!comments.length"
          key="empty"
          class="m-0 rounded-sm border border-dashed border-border bg-background/30 px-4 py-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
          data-testid="news-comments-empty"
        >
          {{
            open
              ? $t("pages.news.comments.empty_open")
              : $t("pages.news.comments.empty_closed")
          }}
        </p>

        <div v-else key="list" class="grid gap-4">
          <TransitionGroup
            tag="ol"
            class="m-0 grid list-none gap-4 p-0"
            enter-active-class="transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none"
            enter-from-class="opacity-0 translate-y-1"
            leave-active-class="transition-opacity duration-200 ease-in motion-reduce:transition-none"
            leave-to-class="opacity-0"
          >
            <NewsComment
              v-for="comment in comments"
              :key="comment.id"
              :comment="comment"
              :viewer="viewer"
              :now="now"
              :replying-to="replyingTo"
              :editing="editing"
              :highlighted="highlighted"
              :votes="votes"
              :send-reply="sendReply"
              :send-edit="sendEdit"
              @reply="startReply"
              @cancel-reply="replyingTo = null"
              @edit="startEdit"
              @cancel-edit="editing = null"
              @vote="vote"
              @delete="(c: Comment) => (deleteTarget = c)"
              @hide="askHide"
              @restore="restore"
              @copy-link="copyLink"
            />
          </TransitionGroup>

          <div v-if="hasMore" class="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              :loading="loadingMore"
              data-testid="news-comments-more"
              @click="showMore"
            >
              {{ $t("pages.news.comments.show_more") }}
            </Button>
          </div>
        </div>
      </FadeSwap>
    </div>

    <AlertDialog v-model:open="hideOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("pages.news.comments.hide_dialog.title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("pages.news.comments.hide_dialog.description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          v-model="hideReason"
          :maxlength="NEWS_COMMENT_HIDE_REASON_MAX_LENGTH"
          :placeholder="$t('pages.news.comments.hide_dialog.reason')"
          :aria-label="$t('pages.news.comments.hide_dialog.reason')"
          data-testid="news-comment-hide-reason"
        />
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <Button
            variant="destructive"
            data-testid="news-comment-hide-confirm"
            @click="confirmHide"
          >
            {{ $t("pages.news.comments.hide_dialog.action") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("pages.news.comments.delete_dialog.title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("pages.news.comments.delete_dialog.description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <Button
            variant="destructive"
            data-testid="news-comment-delete-confirm"
            @click="confirmDelete"
          >
            {{ $t("pages.news.comments.delete") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
