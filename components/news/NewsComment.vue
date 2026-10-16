<script setup lang="ts">
import { computed } from "vue";
import {
  EyeOff,
  Link2,
  MoreVertical,
  Pencil,
  Reply,
  ThumbsUp,
  Trash2,
  Undo2,
} from "lucide-vue-next";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { HeightSwap } from "~/components/ui/transitions";
import TimeAgo from "~/components/TimeAgo.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import NewsCommentComposer from "~/components/news/NewsCommentComposer.vue";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { dateLocale } from "~/utilities/dateLocale";
import {
  newsCommentEditMinutesLeft,
  type NewsComment,
  type NewsCommentViewer,
} from "~/utilities/newsComments";

const props = defineProps<{
  comment: NewsComment;
  viewer: NewsCommentViewer;
  now: number;
  isReply?: boolean;
  threadRemoved?: boolean;
  replyingTo: string | null;
  editing: string | null;
  highlighted: string | null;
  votes: Record<string, { vote_count: number; voted: boolean; busy: boolean }>;
  sendReply: (comment: NewsComment, body: string) => Promise<boolean>;
  sendEdit: (comment: NewsComment, body: string) => Promise<boolean>;
}>();

const emit = defineEmits<{
  reply: [comment: NewsComment];
  cancelReply: [];
  edit: [comment: NewsComment];
  cancelEdit: [];
  vote: [comment: NewsComment];
  delete: [comment: NewsComment];
  hide: [comment: NewsComment];
  restore: [comment: NewsComment];
  copyLink: [comment: NewsComment];
}>();

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain);

const author = computed(() => props.comment.author?.[0] ?? null);
const avatar = computed(() =>
  author.value
    ? resolveAvatarUrl(
        author.value.custom_avatar_url || author.value.avatar_url,
        apiDomain.value,
        64,
      )
    : null,
);

const mine = computed(
  () =>
    !!props.viewer.steamId &&
    String(author.value?.steam_id) === props.viewer.steamId,
);
const deleted = computed(() => !!props.comment.deleted_at);
const hidden = computed(() => !!props.comment.hidden_at);
const removedForViewer = computed(
  () => deleted.value || (hidden.value && !props.viewer.staff),
);

const vote = computed(
  () =>
    props.votes[props.comment.id] ?? {
      vote_count: props.comment.vote_count,
      voted: props.comment.viewer_voted,
      busy: false,
    },
);
const canVote = computed(
  () =>
    !mine.value &&
    !hidden.value &&
    (props.viewer.canWrite ||
      (vote.value.voted && props.viewer.canTakeBackVote)),
);

const editMinutes = computed(() =>
  mine.value && props.viewer.canWrite
    ? newsCommentEditMinutesLeft(props.comment, props.now)
    : 0,
);

const canDelete = computed(
  () => !deleted.value && (mine.value || props.viewer.staff),
);

const fullDate = (value: string) =>
  new Date(value).toLocaleString(dateLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  });
</script>

<template>
  <li
    :id="`comment-${comment.id}`"
    :data-comment-id="comment.id"
    class="grid scroll-mt-24 gap-3"
  >
    <div
      class="-mx-2 grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-md px-2 py-1.5 transition-[background-color,box-shadow] duration-500 ease-out motion-reduce:transition-none"
      :class="
        highlighted === comment.id
          ? 'bg-[hsl(var(--tac-amber)/0.1)] shadow-[inset_0_0_0_1px_hsl(var(--tac-amber)/0.45)]'
          : ''
      "
    >
      <template v-if="removedForViewer">
        <span
          class="row-span-2 h-8 w-8 rounded-md bg-muted/60 opacity-40"
          aria-hidden="true"
        ></span>
        <p
          class="m-0 self-center text-[0.8125rem] italic text-muted-foreground"
          data-testid="news-comment-removed"
        >
          {{
            deleted && !comment.deleted_by_staff
              ? $t("pages.news.comments.deleted")
              : $t("pages.news.comments.removed_by_staff")
          }}
        </p>
        <span></span>
      </template>

      <template v-else>
        <NuxtLink
          v-if="author"
          :to="{ name: 'players-id', params: { id: author.steam_id } }"
          class="row-span-2 shrink-0"
          :class="hidden ? 'opacity-60' : ''"
          :aria-label="author.name"
        >
          <Avatar shape="square" class="h-8 w-8">
            <AvatarImage v-if="avatar" :src="avatar" :alt="author.name" />
            <AvatarFallback>{{ author.name.slice(0, 2) }}</AvatarFallback>
          </Avatar>
        </NuxtLink>
        <span v-else class="row-span-2 h-8 w-8 rounded-md bg-muted/60"></span>

        <div
          class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.8125rem]"
        >
          <NuxtLink
            v-if="author"
            :to="{ name: 'players-id', params: { id: author.steam_id } }"
            class="min-w-0 truncate font-semibold transition-colors duration-150 hover:text-[hsl(var(--tac-amber))]"
          >
            {{ author.name }}
          </NuxtLink>
          <FiveStackToolTip as-child :delay-duration="120" side="top">
            <template #trigger>
              <span
                tabindex="0"
                class="rounded-sm text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <TimeAgo :date="comment.created_at" hide-icon />
              </span>
            </template>
            {{ fullDate(comment.created_at) }}
          </FiveStackToolTip>
          <FiveStackToolTip
            v-if="comment.edited_at"
            as-child
            :delay-duration="120"
            side="top"
          >
            <template #trigger>
              <span
                tabindex="0"
                class="rounded-sm text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="news-comment-edited"
              >
                · {{ $t("pages.news.comments.edited") }}
              </span>
            </template>
            {{
              $t("pages.news.comments.edited_at", {
                date: fullDate(comment.edited_at),
              })
            }}
          </FiveStackToolTip>
          <span
            v-if="hidden"
            class="self-center rounded-sm border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
            data-testid="news-comment-hidden"
          >
            {{ $t("pages.news.comments.hidden_badge") }}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="-mr-2 -mt-1 h-7 w-7 text-muted-foreground [&_svg]:size-4"
              :aria-label="
                $t('pages.news.comments.more_actions', {
                  name: author?.name ?? '',
                })
              "
              data-testid="news-comment-menu"
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-48">
            <DropdownMenuItem
              v-if="viewer.staff && hidden"
              @select="emit('restore', comment)"
            >
              <Undo2 />
              <span>{{ $t("pages.news.comments.restore") }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              v-else-if="viewer.staff && !mine"
              @select="emit('hide', comment)"
            >
              <EyeOff />
              <span>{{ $t("pages.news.comments.hide") }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem @select="emit('copyLink', comment)">
              <Link2 />
              <span>{{ $t("pages.news.comments.copy_link") }}</span>
            </DropdownMenuItem>
            <template v-if="canDelete">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive focus:text-destructive"
                data-testid="news-comment-delete"
                @select="emit('delete', comment)"
              >
                <Trash2 />
                <span>{{ $t("pages.news.comments.delete") }}</span>
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>

        <div class="col-start-2 col-end-[-1] min-w-0">
          <HeightSwap>
            <NewsCommentComposer
              v-if="editing === comment.id"
              key="editor"
              :initial="comment.text ?? ''"
              :submit-label="$t('pages.news.comments.save')"
              :hint="
                $t('pages.news.comments.edit_minutes_left', {
                  count: editMinutes,
                })
              "
              :send="(body: string) => sendEdit(comment, body)"
              autofocus
              @cancel="emit('cancelEdit')"
            />
            <p
              v-else
              key="text"
              class="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]"
              :class="hidden ? 'text-muted-foreground' : 'text-foreground/90'"
              data-testid="news-comment-text"
            >
              {{ comment.text }}
            </p>
          </HeightSwap>
          <p
            v-if="hidden && viewer.staff"
            class="m-0 mt-1 text-xs text-muted-foreground"
            data-testid="news-comment-hidden-by"
          >
            {{
              comment.hidden_reason
                ? $t("pages.news.comments.hidden_by_reason", {
                    name: comment.hidden_by_name ?? "",
                    reason: comment.hidden_reason,
                  })
                : $t("pages.news.comments.hidden_by", {
                    name: comment.hidden_by_name ?? "",
                  })
            }}
          </p>
        </div>

        <div
          v-if="editing !== comment.id && !hidden"
          class="col-start-2 col-end-[-1] -ml-2 flex flex-wrap items-center gap-1"
        >
          <FiveStackToolTip
            as-child
            :disabled="!mine"
            :delay-duration="200"
            side="top"
          >
            <template #trigger>
              <span
                class="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                :tabindex="mine ? 0 : undefined"
              >
                <button
                  type="button"
                  class="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs tabular-nums transition-colors duration-150 disabled:pointer-events-none [&_svg]:h-3.5 [&_svg]:w-3.5"
                  :class="[
                    vote.voted
                      ? 'bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                      : 'text-muted-foreground',
                    canVote && !vote.voted
                      ? 'hover:bg-[hsl(var(--tac-amber)/0.1)] hover:text-[hsl(var(--tac-amber))]'
                      : '',
                    !canVote ? 'opacity-50' : '',
                  ]"
                  :disabled="!canVote || vote.busy"
                  :aria-pressed="vote.voted"
                  :aria-label="
                    $t('pages.news.comments.plus_one_label', {
                      count: vote.vote_count,
                    })
                  "
                  data-testid="news-comment-vote"
                  @click="emit('vote', comment)"
                >
                  <ThumbsUp />
                  +1 · {{ vote.vote_count }}
                </button>
              </span>
            </template>
            {{ $t("pages.news.comments.own_vote") }}
          </FiveStackToolTip>
          <button
            v-if="viewer.canWrite && !threadRemoved"
            type="button"
            class="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/40 hover:text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5"
            data-testid="news-comment-reply"
            @click="emit('reply', comment)"
          >
            <Reply />
            {{ $t("pages.news.comments.reply") }}
          </button>
          <button
            v-if="editMinutes > 0"
            type="button"
            class="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/40 hover:text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5"
            data-testid="news-comment-edit"
            @click="emit('edit', comment)"
          >
            <Pencil />
            {{ $t("pages.news.comments.edit") }}
            <span
              class="font-mono text-[0.6rem] tabular-nums text-muted-foreground/70"
            >
              {{ $t("pages.news.comments.minutes", { count: editMinutes }) }}
            </span>
          </button>
        </div>
      </template>
    </div>

    <HeightSwap>
      <div
        v-if="replyingTo === comment.id"
        key="reply"
        :class="isReply ? '' : 'ml-11 border-l border-border pl-4'"
      >
        <NewsCommentComposer
          :placeholder="
            $t('pages.news.comments.reply_placeholder', {
              name: author?.name ?? '',
            })
          "
          :submit-label="$t('pages.news.comments.reply')"
          :send="(body: string) => sendReply(comment, body)"
          autofocus
          @cancel="emit('cancelReply')"
        />
      </div>
    </HeightSwap>

    <TransitionGroup
      v-if="!isReply && comment.replies?.length"
      tag="ol"
      class="m-0 ml-11 grid list-none gap-3 border-l border-border p-0 pl-4"
      enter-active-class="transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 translate-y-1"
      leave-active-class="transition-opacity duration-200 ease-in motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <NewsComment
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :viewer="viewer"
        :now="now"
        :replying-to="replyingTo"
        :editing="editing"
        :highlighted="highlighted"
        :votes="votes"
        :send-reply="sendReply"
        :send-edit="sendEdit"
        is-reply
        :thread-removed="deleted || hidden"
        @reply="(c: NewsComment) => emit('reply', c)"
        @cancel-reply="emit('cancelReply')"
        @edit="(c: NewsComment) => emit('edit', c)"
        @cancel-edit="emit('cancelEdit')"
        @vote="(c: NewsComment) => emit('vote', c)"
        @delete="(c: NewsComment) => emit('delete', c)"
        @hide="(c: NewsComment) => emit('hide', c)"
        @restore="(c: NewsComment) => emit('restore', c)"
        @copy-link="(c: NewsComment) => emit('copyLink', c)"
      />
    </TransitionGroup>
  </li>
</template>
