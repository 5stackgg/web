import { ref, computed, watch } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { MY_SCHEDULE_TASKS_SUBSCRIPTION } from "~/graphql/leagues";

export type LeagueScheduleTask = {
  id: string;
  bracketId: string;
  seasonId: string;
  seasonNumber: number | null;
  round: number;
  team1: string;
  team2: string;
  kind: "schedule" | "respond";
  proposal: {
    id: string;
    proposedTime: string;
    message: string | null;
    proposedByName: string;
  } | null;
  week: {
    week_number: number;
    opens_at: string;
    closes_at: string;
    default_match_at: string;
  } | null;
};

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
  // Set on client-derived notifications (e.g. seasons needing a rebuild) that
  // have no backing row — action handlers must not try to mutate them by id.
  __synthetic?: boolean;
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
  const draft_invites = ref<any[]>([]);
  const notifications = ref<Notification[]>([]);
  const seasonRebuilds = ref<Array<{ id: any; number: number | null }>>([]);
  // Raw league seasons (with only the viewer's un-played brackets, filtered
  // server-side); actionability is derived below into `scheduleTasks` — a
  // client-only surface with no backing rows. Queried via league_seasons (not
  // tournament_brackets) because only that root is readable by the app's role.
  const scheduleTaskSeasons = ref<any[]>([]);

  // Don't dump all 8 weeks at once — teams only need to sort out the next
  // couple of match weeks. We surface tasks from the nearest N unscheduled
  // weeks (by round), so the feed stays focused on what's actually up next.
  const SCHEDULE_WEEKS_AHEAD = 2;

  const scheduleTasks = computed<LeagueScheduleTask[]>(() => {
    if (!useApplicationSettingsStore().seasonsEnabled) return [];
    const me = useAuthStore().me?.steam_id;
    if (!me) return [];
    const tasks: LeagueScheduleTask[] = [];
    for (const season of scheduleTaskSeasons.value) {
      // Un-played brackets only exist once a season is under way, so surface
      // them unless the season has ended/been called off.
      if (["Finished", "Canceled"].includes(season.status)) continue;
      const weeks = season.match_weeks ?? [];
      for (const sd of season.season_divisions ?? []) {
        for (const stage of sd.tournament?.stages ?? []) {
          for (const b of stage.brackets ?? []) {
            const pending = (b.scheduling_proposals ?? []).filter(
              (p: any) => p.status === "Pending",
            );
            // A proposal from the opponent I can answer takes priority;
            // otherwise an untouched, unscheduled match needs a first proposal
            // from me. (A pending proposal I sent = waiting on them.)
            const respond = pending.find(
              (p: any) => String(p.proposed_by_steam_id) !== String(me),
            );
            let kind: "schedule" | "respond" | null = null;
            if (respond) kind = "respond";
            else if (!b.scheduled_at && !pending.length) kind = "schedule";
            if (!kind) continue;
            const week =
              weeks.find((w: any) => w.week_number === b.round) ?? null;
            tasks.push({
              id: `schedule:${b.id}`,
              bracketId: b.id,
              seasonId: season.id,
              seasonNumber: season.season_number,
              round: b.round,
              team1: b.team_1?.name ?? "TBD",
              team2: b.team_2?.name ?? "TBD",
              kind,
              proposal: respond
                ? {
                    id: respond.id,
                    proposedTime: respond.proposed_time,
                    message: respond.message,
                    proposedByName: respond.proposed_by?.name ?? "?",
                  }
                : null,
              week,
            });
          }
        }
      }
    }
    // Nearest week first, then keep only the nearest couple of weeks so the
    // feed reflects priority rather than an 8-week backlog.
    tasks.sort((a, b) => a.round - b.round);
    const nearestRounds = [...new Set(tasks.map((t) => t.round))]
      .sort((a, b) => a - b)
      .slice(0, SCHEDULE_WEEKS_AHEAD);
    return tasks.filter((t) => nearestRounds.includes(t.round));
  });

  const scheduleTaskCount = computed(() => scheduleTasks.value.length);

  // Admin-only, derived from seasons.needs_rebuild — not stored rows. They carry
  // a Rebuild action and clear themselves when the backfill flips needs_rebuild
  // false, so nothing is ever created or deleted in the notifications table.
  const seasonRebuildNotifications = computed<Notification[]>(() => {
    if (!useApplicationSettingsStore().seasonsEnabled) {
      return [];
    }
    if (!useAuthStore().isAdmin) {
      return [];
    }
    return seasonRebuilds.value.map((season) => ({
      id: `season-rebuild:${season.id}`,
      __synthetic: true,
      title: `Season ${season.number ?? "?"} ELO rebuild required`,
      message:
        "This season's ELO is out of date. Rebuild to recompute its ELO and standings.",
      steam_id: "",
      type: "EloRecompute",
      role: "administrator",
      entity_id: `season-rebuild:${season.id}`,
      is_read: false,
      deletable: false,
      created_at: new Date().toISOString(),
      actions: [
        {
          label: "Rebuild Season ELO",
          graphql: {
            type: "mutation",
            action: "backfillSeasonElo",
            selection: { success: true, running: true },
            variables: { season_id: season.id },
          },
        },
      ],
    }));
  });

  // DB notifications + client-derived ones, in one list for the panel + counts.
  const allNotifications = computed<Notification[]>(() => [
    ...seasonRebuildNotifications.value,
    ...notifications.value,
  ]);

  const seasonRebuildCount = computed(
    () => seasonRebuildNotifications.value.length,
  );
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

  // "Personal" (non-admin) items are the ones aimed at the player — invites and
  // role=user notifications. These drive the orange, ringing bell + sound. Admin
  // notifications (role above user) get a quieter indicator since admins tend to
  // let them pile up.
  const personalUnread = computed(
    () =>
      allNotifications.value.filter((n) => !n.is_read && n.role === "user")
        .length,
  );
  const adminUnread = computed(
    () =>
      allNotifications.value.filter((n) => !n.is_read && n.role !== "user")
        .length,
  );

  const hasPersonalNotifications = computed(
    () =>
      !!unreadNewsArticle.value ||
      team_invites.value.length > 0 ||
      tournament_team_invites.value.length > 0 ||
      draft_invites.value.length > 0 ||
      scheduleTasks.value.length > 0 ||
      personalUnread.value > 0,
  );

  const hasAdminNotifications = computed(() => adminUnread.value > 0);

  const unreadNotificationCount = computed(
    () =>
      (unreadNewsArticle.value ? 1 : 0) +
      team_invites.value.length +
      tournament_team_invites.value.length +
      draft_invites.value.length +
      scheduleTasks.value.length +
      personalUnread.value +
      adminUnread.value,
  );

  const hasNotifications = computed(
    () => hasPersonalNotifications.value || hasAdminNotifications.value,
  );

  const stackedNotifications = computed<NotificationStackItem[]>(() => {
    const groups = new Map<string, Notification[]>();
    const singles: Notification[] = [];

    for (const n of allNotifications.value) {
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
      "notifications:draft_invites",
      getGraphqlClient()
        .subscribe({
          query: typedGql("subscription")({
            draft_game_players: [
              {
                where: {
                  steam_id: { _eq: $("steam_id", "bigint!") },
                  status: { _eq: "Invited" },
                  draft_game: {
                    match_id: { _is_null: true },
                    status: { _nin: ["Completed", "Canceled"] },
                  },
                },
              },
              {
                draft_game_id: true,
                status: true,
                draft_game: {
                  id: true,
                  type: true,
                  mode: true,
                  host: { ...playerFields },
                },
              },
            ],
          }),
          variables: { steam_id },
        })
        .subscribe({
          next: ({ data }) => {
            draft_invites.value = data.draft_game_players;
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

    // Not gated on seasonsEnabled here — that setting loads async and this
    // runs once at login, so gating would race it out. The scheduleTasks
    // computed guards seasonsEnabled at read time instead.
    subscribe(
      "notifications:schedule_tasks",
      getGraphqlClient()
        .subscribe({
          query: MY_SCHEDULE_TASKS_SUBSCRIPTION,
          variables: { steamId: steam_id },
        })
        .subscribe({
          next: ({ data }: { data: any }) => {
            scheduleTaskSeasons.value = data?.league_seasons ?? [];
          },
          error: () => {
            scheduleTaskSeasons.value = [];
          },
        }),
    );

    if (useAuthStore().isAdmin) {
      subscribe(
        "notifications:season_rebuilds",
        getGraphqlClient()
          .subscribe({
            query: typedGql("subscription")({
              seasons: [
                { where: { needs_rebuild: { _eq: true } } },
                { id: true, number: true },
              ],
            }),
          })
          .subscribe({
            next: ({ data }) => {
              seasonRebuilds.value = data?.seasons ?? [];
            },
          }),
      );
    }

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
        unsubscribe("notifications:draft_invites");
        unsubscribe("notifications:notifications");
        unsubscribe("notifications:schedule_tasks");
        unsubscribe("notifications:season_rebuilds");
        unsubscribe("notifications:latest_news");
        unsubscribe("notifications:news_read_state");
        seasonRebuilds.value = [];
        scheduleTaskSeasons.value = [];
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
    draft_invites,
    notifications: allNotifications,
    seasonRebuildCount,
    scheduleTasks,
    scheduleTaskCount,
    stackedNotifications,
    unreadNotificationCount,
    hasNotifications,
    hasPersonalNotifications,
    hasAdminNotifications,
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
