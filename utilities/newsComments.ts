export const NEWS_COMMENT_MAX_LENGTH = 2000;
export const NEWS_COMMENT_HIDE_REASON_MAX_LENGTH = 500;
export const NEWS_COMMENTS_OPEN_MS = 7 * 24 * 60 * 60_000;
export const NEWS_COMMENT_EDIT_MS = 10 * 60_000;
export const NEWS_COMMENTS_PAGE = 20;

// The api refuses with one of these as the whole message; see the api's
// src/news/enums/NewsCommentError.ts.
const NEWS_COMMENT_ERROR_KEYS: Record<string, string> = {
  news_comment_sign_in: "pages.news.comments.sign_in_prompt",
  news_comment_not_verified: "pages.news.comments.read_only.not_verified",
  news_comment_banned: "pages.news.comments.read_only.banned",
  news_comment_gagged: "pages.news.comments.read_only.gagged",
  news_comment_muted: "pages.news.comments.read_only.muted",
  news_comment_closed: "pages.news.comments.read_only.closed",
  news_comment_own_vote: "pages.news.comments.own_vote",
  news_comment_not_found: "pages.news.comments.errors.not_found",
  news_comment_empty: "pages.news.comments.errors.empty",
  news_comment_too_long: "pages.news.comments.errors.too_long",
  news_comment_parent_removed: "pages.news.comments.errors.parent_removed",
  news_comment_rate_limited: "pages.news.comments.errors.rate_limited",
  news_comment_daily_limit: "pages.news.comments.errors.daily_limit",
  news_comment_not_yours: "pages.news.comments.errors.not_yours",
  news_comment_edit_window: "pages.news.comments.errors.edit_window",
  news_comment_removed: "pages.news.comments.errors.removed",
  news_comment_staff_only: "pages.news.comments.errors.staff_only",
};

export type NewsCommentAuthor = {
  steam_id: string;
  name: string;
  avatar_url: string | null;
  custom_avatar_url: string | null;
};

export type NewsComment = {
  id: string;
  parent_id: string | null;
  author_steam_id: string;
  vote_count: number;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by_staff: boolean;
  hidden_at: string | null;
  hidden_reason?: string | null;
  hidden_by_name?: string | null;
  text: string | null;
  viewer_voted: boolean;
  author: NewsCommentAuthor | null;
  replies?: NewsComment[];
};

export type NewsCommentViewer = {
  steamId: string | null;
  staff: boolean;
  canWrite: boolean;
  canTakeBackVote: boolean;
};

export type NewsCommentSanction = "banned" | "gagged" | "muted";

export function newsCommentErrorKey(message?: string | null): string {
  return (
    NEWS_COMMENT_ERROR_KEYS[message?.trim() ?? ""] ??
    "pages.news.comments.errors.generic"
  );
}

export function newsCommentsClosesAt(
  publishedAt: string | null | undefined,
): number | null {
  if (!publishedAt) {
    return null;
  }

  return new Date(publishedAt).getTime() + NEWS_COMMENTS_OPEN_MS;
}

export function newsCommentsOpen(
  publishedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  const closesAt = newsCommentsClosesAt(publishedAt);

  return closesAt !== null && now < closesAt;
}

// Whole minutes left to edit, 0 once the window has passed or the comment was
// removed.
export function newsCommentEditMinutesLeft(
  comment: Pick<NewsComment, "created_at" | "deleted_at" | "hidden_at">,
  now = Date.now(),
): number {
  if (comment.deleted_at || comment.hidden_at) {
    return 0;
  }

  const left =
    new Date(comment.created_at).getTime() + NEWS_COMMENT_EDIT_MS - now;

  return left > 0 ? Math.ceil(left / 60_000) : 0;
}

export function newsCommentSanction(
  me:
    | {
        is_banned?: boolean | null;
        is_gagged?: boolean | null;
        is_muted?: boolean | null;
      }
    | null
    | undefined,
): NewsCommentSanction | null {
  if (me?.is_banned) {
    return "banned";
  }
  if (me?.is_gagged) {
    return "gagged";
  }
  if (me?.is_muted) {
    return "muted";
  }
  return null;
}

export function newsCommentIdFromHash(hash: string | null | undefined) {
  const match = /^#comment-([0-9a-f-]{36})$/i.exec(hash ?? "");

  return match ? match[1].toLowerCase() : null;
}
