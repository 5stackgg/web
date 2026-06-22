import { ref, computed, watch } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";

type Notification = {
  id: string;
  title: string;
  message: string;
  steam_id: string;
  type: string;
  role: string;
  entity_id: string;
  is_read: boolean;
  deletable: boolean;
  created_at: string;
  actions?: Array<{
    label: string;
    graphql: {
      type: string;
      action: string;
      selection: Record<string, any>;
      variables?: Record<string, any>;
    };
  }>;
};

type NewsArticle = {
  id: string;
  slug: string | null;
  title: string;
  teaser: string | null;
  cover_image_url: string | null;
  published_at: string | null;
};

export type NotificationStackItem =
  | { kind: "single"; notification: Notification }
  | { kind: "stack"; entityId: string; notifications: Notification[] };

export const useNotificationStore = defineStore("notifaicationStore", () => {
  const notificationsGranted = ref(false);
  const notificationsEnabled = ref(false);

  const team_invites = ref<any[]>([]);
  const tournament_team_invites = ref<any[]>([]);
  const notifications = ref<Notification[]>([]);
  const latestNewsArticle = ref<NewsArticle | null>(null);
  const lastReadNewsAt = ref<string | null>(null);

  const unreadNewsArticle = computed(() => {
    if (!useApplicationSettingsStore().newsEnabled) {
      return null;
    }

    const article = latestNewsArticle.value;
    if (!article) {
      return null;
    }

    const lastRead = lastReadNewsAt.value;
    if (
      lastRead &&
      article.published_at &&
      new Date(article.published_at) <= new Date(lastRead)
    ) {
      return null;
    }

    return article;
  });

  const markNewsRead = async (upTo?: string | null) => {
    const me = useAuthStore().me;
    if (!me?.steam_id) {
      return;
    }

    const target =
      upTo || latestNewsArticle.value?.published_at || new Date().toISOString();

    if (
      lastReadNewsAt.value &&
      new Date(target) <= new Date(lastReadNewsAt.value)
    ) {
      return;
    }

    try {
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          update_players_by_pk: [
            {
              pk_columns: { steam_id: me.steam_id },
              _set: { last_read_news_at: target },
            },
            { __typename: true },
          ],
        }),
      });
      lastReadNewsAt.value = target;
    } catch (error) {
      console.error("failed to mark news as read", error);
    }
  };

  const hasNotifications = computed(() => {
    if (unreadNewsArticle.value) {
      return true;
    }
    if (team_invites.value.length > 0) {
      return true;
    }
    if (tournament_team_invites.value.length > 0) {
      return true;
    }
    return notifications.value.some((n) => !n.is_read);
  });

  const stackedNotifications = computed<NotificationStackItem[]>(() => {
    const groups = new Map<string, Notification[]>();
    const singles: Notification[] = [];

    for (const n of notifications.value) {
      const groupKey =
        n.type === "PlayerSanctioned"
          ? `type:PlayerSanctioned:${n.role}`
          : n.entity_id;
      if (!groupKey) {
        singles.push(n);
        continue;
      }
      const arr = groups.get(groupKey);
      if (arr) {
        arr.push(n);
      } else {
        groups.set(groupKey, [n]);
      }
    }

    const items: NotificationStackItem[] = [];
    for (const n of singles) {
      items.push({ kind: "single", notification: n });
    }
    for (const [entityId, arr] of groups) {
      arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (arr.length === 1) {
        items.push({ kind: "single", notification: arr[0] });
      } else {
        items.push({ kind: "stack", entityId, notifications: arr });
      }
    }

    const latestAt = (item: NotificationStackItem) =>
      item.kind === "single"
        ? item.notification.created_at
        : item.notifications[0].created_at;

    items.sort((a, b) => latestAt(b).localeCompare(latestAt(a)));
    return items;
  });

  const sendNotification = async (
    title: string,
    tag: string,
    options: NotificationOptions,
    force: boolean = false,
  ) => {
    if (notificationsEnabled.value) {
      if (
        (document.visibilityState !== "hidden" && !force) ||
        Notification.permission !== "granted"
      ) {
        return;
      }
      new Notification(title, {
        ...options,
        icon: "/favicon/64.png",
      });
    }
  };

  const setupNotifications = async () => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        notificationsGranted.value = true;
        notificationsEnabled.value = true;
        return;
      }
      const permission = await Notification.requestPermission();

      notificationsGranted.value = permission === "granted";
      notificationsEnabled.value = notificationsGranted.value;
    }
  };

  function subscribeToAll(steam_id: string) {
    const { subscribe } = useSubscriptionManager();

    subscribe(
      "notifications:team_invites",
      getGraphqlClient()
        .subscribe({
          query: typedGql("subscription")({
            team_invites: [
              {
                order_by: [{}, { created_at: order_by.desc }],
                where: { steam_id: { _eq: $("steam_id", "bigint!") } },
              },
              {
                id: true,
                team: { id: true, name: true },
                invited_by: { ...playerFields },
                created_at: true,
              },
            ],
          }),
          variables: { steam_id },
        })
        .subscribe({
          next: ({ data }) => {
            team_invites.value = data.team_invites;
          },
        }),
    );

    subscribe(
      "notifications:tournament_team_invites",
      getGraphqlClient()
        .subscribe({
          query: typedGql("subscription")({
            tournament_team_invites: [
              {
                order_by: [{}, { created_at: order_by.desc }],
                where: { steam_id: { _eq: $("steam_id", "bigint!") } },
              },
              {
                id: true,
                team: { id: true, name: true, tournament: { name: true } },
                invited_by: { ...playerFields },
                created_at: true,
              },
            ],
          }),
          variables: { steam_id },
        })
        .subscribe({
          next: ({ data }) => {
            tournament_team_invites.value = data.tournament_team_invites;
          },
        }),
    );

    subscribe(
      "notifications:notifications",
      getGraphqlClient()
        .subscribe({
          query: typedGql("subscription")({
            notifications: [
              {
                order_by: [{}, { created_at: order_by.desc }],
                where: {
                  _and: [
                    { deleted_at: { _is_null: true } },
                    {
                      _or: [
                        { is_read: { _eq: false } },
                        {
                          _and: [
                            { is_read: { _eq: true } },
                            {
                              created_at: {
                                _gt: new Date(
                                  Date.now() - 7 * 24 * 60 * 60 * 1000,
                                ),
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
              {
                id: true,
                title: true,
                message: true,
                steam_id: true,
                type: true,
                role: true,
                entity_id: true,
                is_read: true,
                deletable: true,
                created_at: true,
                actions: true,
              },
            ],
          }),
        })
        .subscribe({
          next: ({ data }) => {
            notifications.value = data.notifications;
          },
        }),
    );

    subscribe(
      "notifications:latest_news",
      getGraphqlClient()
        .subscribe({
          query: typedGql("subscription")({
            news_articles: [
              {
                where: { status: { _eq: "published" } },
                order_by: [{ published_at: order_by.desc_nulls_last }],
                limit: 1,
              },
              {
                id: true,
                slug: true,
                title: true,
                teaser: true,
                cover_image_url: true,
                published_at: true,
              },
            ],
          }),
        })
        .subscribe({
          next: ({ data }) => {
            latestNewsArticle.value = data.news_articles[0] ?? null;
          },
        }),
    );

    subscribe(
      "notifications:news_read_state",
      getGraphqlClient()
        .subscribe({
          query: typedGql("subscription")({
            players_by_pk: [
              { steam_id: $("steam_id", "bigint!") },
              { last_read_news_at: true },
            ],
          }),
          variables: { steam_id },
        })
        .subscribe({
          next: ({ data }) => {
            lastReadNewsAt.value = data.players_by_pk?.last_read_news_at ?? null;
          },
        }),
    );
  }

  watch(
    () => useAuthStore().me?.steam_id,
    (steamId) => {
      if (steamId) {
        subscribeToAll(steamId);
      } else {
        const { unsubscribe } = useSubscriptionManager();
        unsubscribe("notifications:team_invites");
        unsubscribe("notifications:tournament_team_invites");
        unsubscribe("notifications:notifications");
        unsubscribe("notifications:latest_news");
        unsubscribe("notifications:news_read_state");
        lastReadNewsAt.value = null;
      }
    },
    { immediate: true },
  );

  setupNotifications();

  return {
    notificationsGranted,
    notificationsEnabled,
    sendNotification,
    team_invites,
    tournament_team_invites,
    notifications,
    stackedNotifications,
    hasNotifications,
    latestNewsArticle,
    unreadNewsArticle,
    markNewsRead,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useNotificationStore, import.meta.hot),
  );
}
