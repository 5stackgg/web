import gql from "graphql-tag";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import type { NewsComment } from "~/utilities/newsComments";

// Plain documents rather than zeus: news_comments only reaches generated/zeus
// with the next codegen, and the section must keep working against an api
// that does not have it yet (see schemaHasType in NewsComments.vue).
const fields = (staff: boolean) => `
  id
  parent_id
  author_steam_id
  vote_count
  created_at
  edited_at
  deleted_at
  deleted_by_staff
  hidden_at
  text
  viewer_voted
  ${staff ? "hidden_reason hidden_by_name" : ""}
  author {
    steam_id
    name
    avatar_url
    custom_avatar_url
  }
`;

const threadsSubscription = (staff: boolean) => gql`
  subscription NewsCommentThreads($article: uuid!, $limit: Int!) {
    news_comments(
      where: { article_id: { _eq: $article }, parent_id: { _is_null: true } }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      ${fields(staff)}
      replies(order_by: { created_at: asc }) {
        ${fields(staff)}
      }
    }
  }
`;

const COUNT_SUBSCRIPTION = gql`
  subscription NewsCommentCount($article: uuid!) {
    news_comments_aggregate(
      where: {
        article_id: { _eq: $article }
        deleted_at: { _is_null: true }
        hidden_at: { _is_null: true }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

const POST = gql`
  mutation PostNewsComment($article: uuid!, $parent: uuid, $body: String!) {
    postNewsComment(article_id: $article, parent_id: $parent, body: $body) {
      id
      parent_id
    }
  }
`;

const EDIT = gql`
  mutation EditNewsComment($id: uuid!, $body: String!) {
    editNewsComment(id: $id, body: $body) {
      id
    }
  }
`;

const DELETE = gql`
  mutation DeleteNewsComment($id: uuid!) {
    deleteNewsComment(id: $id) {
      success
    }
  }
`;

const VOTE = gql`
  mutation ToggleNewsCommentVote($id: uuid!) {
    toggleNewsCommentVote(id: $id) {
      comment_id
      vote_count
      voted
    }
  }
`;

const HIDE = gql`
  mutation SetNewsCommentHidden(
    $id: uuid!
    $hidden: Boolean!
    $reason: String
  ) {
    setNewsCommentHidden(id: $id, hidden: $hidden, reason: $reason) {
      id
    }
  }
`;

type Handlers<T> = {
  next: (value: T) => void;
  error: (error: unknown) => void;
};

// Refusals come back as a NewsCommentError code, which the section translates
// itself, so the app-wide toast would only repeat it as a slug.
const quiet = { optional: true };

export function useNewsComments() {
  function watchThreads(
    articleId: string,
    limit: number,
    staff: boolean,
    handlers: Handlers<NewsComment[]>,
  ) {
    return getGraphqlClient()
      .subscribe({
        query: threadsSubscription(staff),
        variables: { article: articleId, limit },
        context: quiet,
      })
      .subscribe({
        next: ({ data }: any) => handlers.next(data?.news_comments ?? []),
        error: handlers.error,
      });
  }

  function watchCount(articleId: string, handlers: Handlers<number>) {
    return getGraphqlClient()
      .subscribe({
        query: COUNT_SUBSCRIPTION,
        variables: { article: articleId },
        context: quiet,
      })
      .subscribe({
        next: ({ data }: any) =>
          handlers.next(
            Number(data?.news_comments_aggregate?.aggregate?.count ?? 0),
          ),
        error: handlers.error,
      });
  }

  async function post(articleId: string, body: string, parentId?: string) {
    const { data } = await getGraphqlClient().mutate({
      mutation: POST,
      variables: { article: articleId, parent: parentId ?? null, body },
      context: quiet,
    });

    return (
      data as {
        postNewsComment: { id: string; parent_id: string | null };
      }
    ).postNewsComment;
  }

  async function edit(id: string, body: string) {
    await getGraphqlClient().mutate({
      mutation: EDIT,
      variables: { id, body },
      context: quiet,
    });
  }

  async function remove(id: string) {
    await getGraphqlClient().mutate({
      mutation: DELETE,
      variables: { id },
      context: quiet,
    });
  }

  async function toggleVote(id: string) {
    const { data } = await getGraphqlClient().mutate({
      mutation: VOTE,
      variables: { id },
      context: quiet,
    });

    return (
      data as {
        toggleNewsCommentVote: {
          comment_id: string;
          vote_count: number;
          voted: boolean;
        };
      }
    ).toggleNewsCommentVote;
  }

  async function setHidden(id: string, hidden: boolean, reason?: string) {
    await getGraphqlClient().mutate({
      mutation: HIDE,
      variables: { id, hidden, reason: reason?.trim() || null },
      context: quiet,
    });
  }

  return {
    watchThreads,
    watchCount,
    post,
    edit,
    remove,
    toggleVote,
    setHidden,
  };
}
