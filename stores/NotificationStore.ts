import { ref, computed, watch } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { playerFields } from "~/graphql/playerFields";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";

type Notification = {
  id: string;
  title: string;
  message: string;
  steam_id: string;
  type: string;
  entity_id: string;
  is_read: boolean;
  deletable: boolean;
  created_at: string;
  actions?: Array<{
    graphql: {
      type: string;
      action: string;
      selection: Record<string, any>;
      variables?: Record<string, any>;
    };
  }>;
};

export const useNotificationStore = defineStore("notifaicationStore", () => {
  const notificationsGranted = ref(false);
  const notificationsEnabled = ref(false);

  const team_invites = ref<any[]>([]);
  const tournament_team_invites = ref<any[]>([]);
  const notifications = ref<Notification[]>([]);

  const hasNotifications = computed(() => {
    if (team_invites.value.length > 0) return true;
    if (tournament_team_invites.value.length > 0) return true;
    return notifications.value.some((n) => !n.is_read);
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
    hasNotifications,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useNotificationStore, import.meta.hot),
  );
}
