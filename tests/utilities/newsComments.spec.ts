// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  newsCommentEditMinutesLeft,
  newsCommentErrorKey,
  newsCommentIdFromHash,
  newsCommentSanction,
  newsCommentsOpen,
} from "~/utilities/newsComments";

const en = JSON.parse(readFileSync("i18n/locales/en.json", "utf8"));

const NOW = Date.parse("2026-10-15T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const DAY = 24 * 60 * 60_000;

const lookup = (key: string) =>
  key.split(".").reduce<any>((node, part) => node?.[part], en);

describe("news comment rules the page mirrors", () => {
  it("keeps a thread open for 7 days after the post is published", () => {
    expect(newsCommentsOpen(ago(6 * DAY + 23 * 3_600_000), NOW)).toBe(true);
    expect(newsCommentsOpen(ago(7 * DAY), NOW)).toBe(false);
    expect(newsCommentsOpen(null, NOW)).toBe(false);
  });

  it("counts down the 10 minutes a comment can be edited, and none once it is removed", () => {
    const comment = { created_at: ago(4 * 60_000), deleted_at: null, hidden_at: null };

    expect(newsCommentEditMinutesLeft(comment, NOW)).toBe(6);
    expect(
      newsCommentEditMinutesLeft({ ...comment, created_at: ago(11 * 60_000) }, NOW),
    ).toBe(0);
    expect(
      newsCommentEditMinutesLeft({ ...comment, hidden_at: ago(0) }, NOW),
    ).toBe(0);
  });

  it("names the sanction that keeps a player from writing, a ban first", () => {
    expect(newsCommentSanction({ is_banned: true, is_gagged: true })).toBe(
      "banned",
    );
    expect(newsCommentSanction({ is_gagged: true, is_muted: true })).toBe(
      "gagged",
    );
    expect(newsCommentSanction({ is_muted: true })).toBe("muted");
    expect(newsCommentSanction(null)).toBeNull();
  });

  it("reads a comment id only from a #comment-<uuid> link", () => {
    expect(
      newsCommentIdFromHash("#comment-C0000000-0000-4000-8000-000000000001"),
    ).toBe("c0000000-0000-4000-8000-000000000001");
    expect(newsCommentIdFromHash("#how-to-join")).toBeNull();
    expect(newsCommentIdFromHash("#comment-<img>")).toBeNull();
  });

  it("puts every refusal the api sends into words, and anything else into a generic line", () => {
    for (const code of [
      "sign_in",
      "not_verified",
      "banned",
      "gagged",
      "muted",
      "not_found",
      "closed",
      "empty",
      "too_long",
      "parent_removed",
      "rate_limited",
      "daily_limit",
      "not_yours",
      "edit_window",
      "removed",
      "own_vote",
      "staff_only",
    ]) {
      const key = newsCommentErrorKey(`news_comment_${code}`);
      expect(key).not.toBe("pages.news.comments.errors.generic");
      expect(typeof lookup(key)).toBe("string");
    }

    expect(newsCommentErrorKey("news_comment_made_up")).toBe(
      "pages.news.comments.errors.generic",
    );
    expect(newsCommentErrorKey(undefined)).toBe(
      "pages.news.comments.errors.generic",
    );
  });
});
