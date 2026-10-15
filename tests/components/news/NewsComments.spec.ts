import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import NewsComments from "~/components/news/NewsComments.vue";
import { useAuthStore } from "~/stores/AuthStore";

const graphql = vi.hoisted(() => ({
  available: true,
  observers: new Map<string, { observer: any; query: string; variables: any }>(),
  mutate: vi.fn(),
}));

const { toast, currentRoute } = vi.hoisted(() => ({
  toast: vi.fn(),
  currentRoute: { hash: "", fullPath: "/news/autumn-cup" },
}));

vi.mock("~/utilities/schemaHasType", () => ({
  schemaHasType: vi.fn(async () => graphql.available),
}));

vi.mock("~/graphql/getGraphqlClient", async () => {
  const { print: render } = await import("graphql");
  return {
    default: () => ({
      mutate: graphql.mutate,
      subscribe: ({ query, variables }: any) => ({
        subscribe(observer: any) {
          const text = render(query);
          const name = /subscription (\w+)/.exec(text)![1];
          graphql.observers.set(name, { observer, query: text, variables });
          return { unsubscribe() {} };
        },
      }),
    }),
  };
});

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

mockNuxtImport("useRoute", () => () => currentRoute);

const ARTICLE = "a0000000-0000-4000-8000-000000000001";
const ME = "76561198000000001";
const BOB = "76561198000000002";
const ADA = "76561198000000003";

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const author = (steamId: string, name: string) => ({
  steam_id: steamId,
  name,
  avatar_url: null,
  custom_avatar_url: null,
});

let seq = 0;
const comment = (over: Record<string, unknown> = {}) => {
  seq += 1;
  const id = `c0000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  return {
    id,
    parent_id: null,
    author_steam_id: BOB,
    vote_count: 0,
    created_at: minutesAgo(60),
    edited_at: null,
    deleted_at: null,
    deleted_by_staff: false,
    hidden_at: null,
    text: `comment ${seq}`,
    viewer_voted: false,
    author: author(BOB, "bob"),
    replies: [],
    ...over,
  };
};

function push(rows: any[], count = rows.length) {
  graphql.observers
    .get("NewsCommentThreads")
    ?.observer.next({ data: { news_comments: rows } });
  graphql.observers.get("NewsCommentCount")?.observer.next({
    data: { news_comments_aggregate: { aggregate: { count } } },
  });
}

function signIn(over: Record<string, unknown> = {}) {
  useAuthStore().me = {
    steam_id: ME,
    name: "me",
    role: "verified_user",
    is_banned: false,
    is_gagged: false,
    is_muted: false,
    ...over,
  } as any;
}

const mounted: Array<{ unmount: () => void }> = [];

async function mountComments(
  rows: any[] = [],
  publishedAt: string = minutesAgo(60 * 24),
) {
  const wrapper = await mountSuspended(NewsComments, {
    props: { articleId: ARTICLE, slug: "autumn-cup", publishedAt },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  await flushPromises();
  push(rows);
  await flushPromises();
  return wrapper;
}

const find = (wrapper: any, id: string) =>
  wrapper.find(`[data-testid="${id}"]`);

beforeEach(() => {
  graphql.available = true;
  graphql.observers.clear();
  graphql.mutate.mockReset();
  toast.mockReset();
  currentRoute.hash = "";
  useAuthStore().me = undefined;
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
});

describe("news comments", () => {
  it("stays off the page while the api has no comments", async () => {
    graphql.available = false;
    const wrapper = await mountComments();

    expect(find(wrapper, "news-comments").exists()).toBe(false);
    expect(graphql.observers.size).toBe(0);
  });

  it("lets a signed-out reader read, asks them to sign in, and keeps +1 from them", async () => {
    const wrapper = await mountComments([comment({ text: "first!" })]);

    expect(find(wrapper, "news-comments-sign-in").exists()).toBe(true);
    expect(find(wrapper, "news-comment-input").exists()).toBe(false);
    expect(find(wrapper, "news-comment-text").text()).toBe("first!");
    expect(
      find(wrapper, "news-comment-vote").attributes("disabled"),
    ).toBeDefined();
    expect(find(wrapper, "news-comment-reply").exists()).toBe(false);
  });

  it.each([
    [{ role: "user" }, "Only verified players can comment and +1."],
    [{ is_gagged: true }, "You're gagged and can't comment."],
    [{ is_muted: true }, "You're muted and can't comment."],
    [{ is_banned: true }, "You're banned and can't comment."],
  ])("tells %o why they can't write", async (over, line) => {
    signIn(over);
    const wrapper = await mountComments([comment()]);

    expect(find(wrapper, "news-comments-read-only").text()).toBe(line);
    expect(find(wrapper, "news-comment-input").exists()).toBe(false);
    expect(
      find(wrapper, "news-comment-vote").attributes("disabled"),
    ).toBeDefined();
  });

  it("closes the box for everyone 7 days after the post is published", async () => {
    signIn();
    const wrapper = await mountComments([], minutesAgo(60 * 24 * 7 + 1));

    expect(find(wrapper, "news-comments-read-only").text()).toBe(
      "Comments are closed. Posts take comments for 7 days after they're published.",
    );
    expect(find(wrapper, "news-comments-empty").text()).toBe(
      "No comments on this post",
    );
  });

  it("says how long the thread stays open, then posts and empties the box", async () => {
    signIn();
    graphql.mutate.mockResolvedValue({
      data: { postNewsComment: { id: "new", parent_id: null } },
    });
    const wrapper = await mountComments([], minutesAgo(60 * 24 * 2));

    expect(wrapper.text()).toContain("Open for 4 more days");
    expect(find(wrapper, "news-comments-empty").text()).toBe(
      "No comments yet. Be the first.",
    );

    await find(wrapper, "news-comment-input").setValue("  Lower bracket?  ");
    await find(wrapper, "news-comment-submit").trigger("click");
    await flushPromises();

    expect(graphql.mutate).toHaveBeenCalledTimes(1);
    expect(graphql.mutate.mock.calls[0][0].variables).toEqual({
      article: ARTICLE,
      parent: null,
      body: "Lower bracket?",
    });
    expect(
      (find(wrapper, "news-comment-input").element as HTMLTextAreaElement)
        .value,
    ).toBe("");
  });

  it("answers a reply under its thread, naming the reply that was answered", async () => {
    signIn();
    graphql.mutate.mockResolvedValue({
      data: { postNewsComment: { id: "new", parent_id: "top" } },
    });
    const reply = comment({
      author_steam_id: ADA,
      author: author(ADA, "ada"),
      text: "agreed",
    });
    const top = comment({ replies: [reply] });
    reply.parent_id = top.id;
    const wrapper = await mountComments([top]);

    const replyButtons = wrapper.findAll('[data-testid="news-comment-reply"]');
    expect(replyButtons).toHaveLength(2);
    await replyButtons[1].trigger("click");
    await flushPromises();

    const input = wrapper.find(
      `[data-comment-id="${reply.id}"] [data-testid="news-comment-input"]`,
    );
    expect(input.attributes("placeholder")).toBe("Reply to ada");
    await input.setValue("same");
    await wrapper
      .find(
        `[data-comment-id="${reply.id}"] [data-testid="news-comment-submit"]`,
      )
      .trigger("click");
    await flushPromises();

    expect(graphql.mutate.mock.calls[0][0].variables).toEqual({
      article: ARTICLE,
      parent: reply.id,
      body: "same",
    });
  });

  it("shows readers a removed comment as a placeholder, with its replies kept", async () => {
    signIn();
    const reply = comment({ text: "reported, ignore this" });
    const hidden = comment({
      hidden_at: minutesAgo(5),
      text: null,
      replies: [reply],
    });
    const deleted = comment({ deleted_at: minutesAgo(5), text: null });
    const wrapper = await mountComments([hidden, deleted]);

    const removed = wrapper.findAll('[data-testid="news-comment-removed"]');
    expect(removed.map((line) => line.text())).toEqual([
      "Removed by staff.",
      "This comment was deleted.",
    ]);
    expect(wrapper.text()).toContain("reported, ignore this");
    expect(find(wrapper, "news-comment-hidden").exists()).toBe(false);
  });

  it("shows staff the hidden text, who hid it and why, and asks for the staff fields", async () => {
    signIn({ role: "moderator" });
    const wrapper = await mountComments([
      comment({
        hidden_at: minutesAgo(5),
        text: "cheap boosting here",
        hidden_by_name: "luke",
        hidden_reason: "link spam",
      }),
    ]);

    expect(find(wrapper, "news-comment-hidden").text()).toBe("Hidden");
    expect(find(wrapper, "news-comment-text").text()).toBe(
      "cheap boosting here",
    );
    expect(find(wrapper, "news-comment-hidden-by").text()).toBe(
      "Hidden by luke · reason: link spam",
    );
    expect(graphql.observers.get("NewsCommentThreads")!.query).toContain(
      "hidden_reason",
    );
  });

  it("never asks the api for the staff fields for anyone else", async () => {
    signIn();
    await mountComments();

    expect(graphql.observers.get("NewsCommentThreads")!.query).not.toContain(
      "hidden_reason",
    );
  });

  it("offers Edit on your own comment only while its 10 minutes last", async () => {
    signIn();
    const fresh = comment({
      author_steam_id: ME,
      author: author(ME, "me"),
      created_at: minutesAgo(4),
    });
    const old = comment({
      author_steam_id: ME,
      author: author(ME, "me"),
      created_at: minutesAgo(11),
    });
    const wrapper = await mountComments([fresh, old]);

    const edits = wrapper.findAll('[data-testid="news-comment-edit"]');
    expect(edits).toHaveLength(1);
    expect(edits[0].text()).toContain("6 min");
    expect(
      wrapper
        .find(`[data-comment-id="${fresh.id}"] [data-testid="news-comment-vote"]`)
        .attributes("disabled"),
    ).toBeDefined();
  });

  it("counts a +1 at once and settles on the api's count", async () => {
    signIn();
    let settle: (value: unknown) => void = () => {};
    graphql.mutate.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const wrapper = await mountComments([comment({ vote_count: 4 })]);
    const button = find(wrapper, "news-comment-vote");

    await button.trigger("click");
    expect(button.text()).toContain("+1 · 5");
    expect(button.attributes("aria-pressed")).toBe("true");

    settle({
      data: {
        toggleNewsCommentVote: { comment_id: "x", vote_count: 7, voted: true },
      },
    });
    await flushPromises();
    expect(button.text()).toContain("+1 · 7");
  });

  it("puts an api refusal into words", async () => {
    signIn();
    graphql.mutate.mockRejectedValue({
      graphQLErrors: [{ message: "news_comment_rate_limited" }],
    });
    const wrapper = await mountComments();

    await find(wrapper, "news-comment-input").setValue("again");
    await find(wrapper, "news-comment-submit").trigger("click");
    await flushPromises();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "You're going too fast. Wait a minute and try again.",
      }),
    );
    expect(
      (find(wrapper, "news-comment-input").element as HTMLTextAreaElement)
        .value,
    ).toBe("again");
  });

  it("brings the comment a notification links to into view and marks it", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const target = comment({ text: "the reply" });
    const top = comment({ replies: [target] });
    target.parent_id = top.id;
    currentRoute.hash = `#comment-${target.id}`;

    const wrapper = await mountComments([top]);
    await flushPromises();

    expect(scrollIntoView).toHaveBeenCalled();
    expect(
      wrapper
        .find(`[data-comment-id="${target.id}"] > div`)
        .classes()
        .join(" "),
    ).toContain("tac-amber");
  });

  it("asks for the next page until the linked comment is on it", async () => {
    const target = comment();
    currentRoute.hash = `#comment-${target.id}`;
    const page = Array.from({ length: 21 }, () => comment());

    await mountComments(page);

    expect(graphql.observers.get("NewsCommentThreads")!.variables.limit).toBe(
      41,
    );
  });

  it("shows the live count of comments", async () => {
    const wrapper = await mountComments([comment(), comment()], undefined);
    push([comment(), comment()], 5);
    await flushPromises();

    expect(find(wrapper, "news-comments-count").text()).toBe("5");
  });
});
