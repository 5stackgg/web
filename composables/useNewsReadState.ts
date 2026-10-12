import { computed } from "vue";

/**
 * "New" on news posts, read from the same watermark the notification bell uses
 * (`players.last_read_news_at`). The watermark only moves forward, so a post is
 * new when it was published after it. Before a player has read anything, only
 * the latest post counts as new, as in the bell.
 */
export function useNewsReadState() {
  const notifications = useNotificationStore();
  const signedIn = computed(() => !!useAuthStore().me);

  function isNew(publishedAt: string | null | undefined) {
    if (!signedIn.value || !publishedAt) {
      return false;
    }
    const lastRead = notifications.lastReadNewsAt;
    if (!lastRead) {
      return notifications.latestNewsArticle?.published_at === publishedAt;
    }
    return new Date(publishedAt) > new Date(lastRead);
  }

  return {
    isNew,
    markRead: (publishedAt?: string | null) =>
      notifications.markNewsRead(publishedAt),
  };
}
