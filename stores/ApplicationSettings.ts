import { defineStore, acceptHMRUpdate } from "pinia";
import { ref, computed, watch } from "vue";
import { e_player_roles_enum, e_match_types_enum } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { useMatchmakingStore } from "./MatchmakingStore";
import { useAuthStore } from "./AuthStore";
import { order_by } from "@/generated/zeus";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";

interface Region {
  value: string;
  description: string;
  is_lan: boolean;
  status: string;
}

export const useApplicationSettingsStore = defineStore(
  "applicationSettings",
  () => {
    const SETTINGS_CACHE_KEY = "5stack:application-settings";

    const loadCachedSettings = (): Array<{
      name: string;
      value: string;
    }> => {
      try {
        const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {}
      return [];
    };

    const settings =
      ref<Array<{ name: string; value: string }>>(loadCachedSettings());

    const subscribeToSettings = async () => {
      const { subscribe } = useSubscriptionManager();
      const subscription = getGraphqlClient().subscribe({
        query: generateSubscription({
          settings: [
            {},
            {
              name: true,
              value: true,
            },
          ],
        }),
      });

      subscribe(
        "settings:settings",
        subscription.subscribe({
          next: ({ data }) => {
            settings.value = data.settings;
            try {
              localStorage.setItem(
                SETTINGS_CACHE_KEY,
                JSON.stringify(data.settings),
              );
            } catch {}
          },
        }),
      );
    };

    subscribeToSettings();

    const gameServerPluginRuntime = computed<string>(() => {
      return (
        settings.value?.find((setting) => {
          return setting.name === "public.game_server_plugin_runtime";
        })?.value || "swiftlys2"
      );
    });

    const pluginVersions = ref<Array<{ version: string; runtime: string }>>([]);

    // Derived rather than filtered in the subscription so switching the runtime
    // setting does not require tearing down and re-establishing the socket.
    const currentPluginVersion = computed<string | null>(() => {
      return (
        pluginVersions.value.find((pluginVersion) => {
          return pluginVersion.runtime === gameServerPluginRuntime.value;
        })?.version ?? null
      );
    });

    const subscribeToPluginVersion = async () => {
      const { subscribe } = useSubscriptionManager();
      const authStore = useAuthStore();
      if (
        !authStore.me ||
        !authStore.isRoleAbove(e_player_roles_enum.match_organizer)
      ) {
        return;
      }

      const subscription = getGraphqlClient().subscribe({
        query: generateSubscription({
          plugin_versions: [
            {
              order_by: [
                {
                  published_at: order_by.desc,
                },
              ],
            },
            {
              version: true,
              runtime: true,
            },
          ],
        }),
      });

      subscribe(
        "settings:plugin_version",
        subscription.subscribe({
          next: ({ data }) => {
            pluginVersions.value = data.plugin_versions;
          },
        }),
      );
    };

    // Watch the auth identity so realtime me refreshes do not resubscribe.
    watch(
      () => useAuthStore().me?.steam_id,
      (steamId) => {
        if (steamId) {
          subscribeToPluginVersion();
        }
      },
      { immediate: true },
    );

    const matchCreateRole = computed(() => {
      if (!settings.value) {
        return false;
      }

      const create_matches_role = settings.value.find(
        (setting) => setting.name === "public.create_matches_role",
      );

      return create_matches_role?.value || e_player_roles_enum.user;
    });

    const customMatchRole = computed(() => {
      if (!settings.value) {
        return false;
      }

      const custom_match_role = settings.value.find(
        (setting) => setting.name === "public.custom_match_role",
      );

      if (custom_match_role?.value) {
        return custom_match_role.value;
      }

      // There's no dedicated UI for "public.custom_match_role", so fall back to
      // the configurable "create matches" role rather than a hardcoded
      // match_organizer — otherwise the UI setting wouldn't govern hosting
      // custom/draft matches.
      const create_matches_role = settings.value.find(
        (setting) => setting.name === "public.create_matches_role",
      );

      return create_matches_role?.value || e_player_roles_enum.user;
    });

    const canCreateCustomMatch = computed(() => {
      const me = useAuthStore().me;
      if (!me) {
        return false;
      }

      return useAuthStore().isRoleAbove(customMatchRole.value);
    });

    const tournamentCreateRole = computed(() => {
      if (!settings.value) {
        return false;
      }

      const create_tournaments_role = settings.value.find(
        (setting) => setting.name === "public.create_tournaments_role",
      );

      return create_tournaments_role?.value || e_player_roles_enum.user;
    });

    const eventCreateRole = computed(() => {
      if (!settings.value) {
        return false;
      }

      const create_events_role = settings.value.find(
        (setting) => setting.name === "public.create_events_role",
      );

      // Match the backend: public_events only has insert permissions for
      // match_organizer and above, so that is the floor when the setting is
      // unset; the setting can only raise it further.
      return create_events_role?.value || e_player_roles_enum.match_organizer;
    });

    // Panel on/off flag only, no role gating — used to show guests "fake"
    // matchmaking cards that prompt login on click.
    const matchmakingEnabled = computed(() => {
      if (!settings.value) {
        return false;
      }

      const matchMakingSetting = settings.value.find(
        (setting) => setting.name === "public.matchmaking",
      );

      return matchMakingSetting ? matchMakingSetting.value === "true" : true;
    });

    const matchmakingAllowed = computed(() => {
      if (!matchmakingEnabled.value) {
        return false;
      }

      const matchmakingMinRole = settings.value.find(
        (setting) => setting.name === "public.matchmaking_min_role",
      );

      if (!matchmakingMinRole) {
        return true;
      }

      return useAuthStore().isRoleAbove(matchmakingMinRole.value);
    });

    const supportsDiscordBot = computed(() => {
      if (!settings.value) {
        return false;
      }

      return (
        settings.value.find(
          (setting) => setting.name === "public.supports_discord_bot",
        )?.value === "true"
      );
    });

    const supportsGameServerNodes = computed(() => {
      if (!settings.value) {
        return false;
      }

      return (
        settings.value.find(
          (setting) => setting.name === "supports_game_server_nodes",
        )?.value === "true"
      );
    });

    const supportsGameServerVersionPinning = computed(() => {
      if (!settings.value) {
        return false;
      }

      return (
        settings.value.find(
          (setting) => setting.name === "supports_game_server_version_pinning",
        )?.value === "true"
      );
    });

    const newsEnabled = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.news_enabled",
        )?.value === "true"
      );
    });

    // Community events: off by default (absent row = disabled), matching the
    // public_events insert permission gate on public.events_enabled.
    const eventsEnabled = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.events_enabled",
        )?.value === "true"
      );
    });

    // Competitive seasons: season-scoped ELO + stats. Off by default; when on,
    // season filtering is shown across the app.
    const seasonsEnabled = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.seasons_enabled",
        )?.value === "true"
      );
    });

    // CAL-style leagues: divisions, weekly seasons, promotion/relegation.
    const leaguesEnabled = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.leagues_enabled",
        )?.value === "true"
      );
    });

    // When off, teams register with no division preference (admins place them).
    const leagueAllowDivisionRequest = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.league_allow_division_request",
        )?.value === "true"
      );
    });

    // Roster sizing is a team-wide rule (not per-season); seasons inherit it.
    const teamMinRosterSize = computed(() => {
      const value = settings.value?.find(
        (setting) => setting.name === "public.team_min_roster_size",
      )?.value;
      return value ? parseInt(value, 10) : 5;
    });

    const teamMaxRosterSize = computed(() => {
      const value = settings.value?.find(
        (setting) => setting.name === "public.team_max_roster_size",
      )?.value;
      return value ? parseInt(value, 10) : 7;
    });

    const teamMaxSubs = computed(() => {
      const value = settings.value?.find(
        (setting) => setting.name === "public.team_max_subs",
      )?.value;
      return value ? parseInt(value, 10) : 2;
    });

    // Anti-cheat: require viewers to be signed in before live game
    // streams are shown. Enabled by default — only an explicit "false"
    // disables it.
    const requireLoginForLiveStreams = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.require_login_for_live_streams",
        )?.value !== "false"
      );
    });

    const newsLabel = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.news_label",
        )?.value || null
      );
    });

    const postNewsRole = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.post_news_role",
        )?.value || e_player_roles_enum.administrator
      );
    });

    const canPostNews = computed(() => {
      const me = useAuthStore().me;
      if (!me) {
        return false;
      }

      return useAuthStore().isRoleAbove(postNewsRole.value);
    });

    const playerNameRegistration = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.player_name_registration",
        )?.value === "true"
      );
    });

    const linkedAccountsEnabled = computed(() => {
      // Default OFF — an admin must explicitly enable external/CS2 imports.
      return (
        settings.value?.find(
          (setting) => setting.name === "public.external_matches_enabled",
        )?.value === "true"
      );
    });

    const faceitEnabled = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.faceit_import_enabled",
        )?.value === "true"
      );
    });

    const scrimFinderEnabled = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.scrim_finder_enabled",
        )?.value !== "false"
      );
    });

    // Plugins (micro-frontend framework): off by default (absent row =
    // disabled). Master switch gating the nav section + /apps/[slug] routes.
    const pluginsEnabled = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.custom_pages_enabled",
        )?.value === "true"
      );
    });

    // HUD layout the game-streamer pod boots (and the demo player should show
    // as active). Legacy "default" folds into "horizontal"; anything but
    // "vertical" is horizontal. Mirrors the api's resolveHudMode default.
    const defaultHudMode = computed<"horizontal" | "vertical">(() => {
      const v = settings.value?.find(
        (setting) => setting.name === "default_hud_mode",
      )?.value;
      return v === "vertical" ? "vertical" : "horizontal";
    });

    const availableRegions = ref<Region[]>([]);

    let latencyCheckInterval: ReturnType<typeof setInterval> | null = null;

    const subscribeToAvailableRegions = async () => {
      const { subscribe } = useSubscriptionManager();
      const subscription = getGraphqlClient().subscribe({
        query: generateSubscription({
          server_regions: [
            {
              where: {
                total_server_count: {
                  _gt: 0,
                },
              },
            },
            {
              value: true,
              status: true,
              description: true,
              is_lan: true,
              has_node: true,
            },
          ],
        }),
      });

      subscribe(
        "settings:available_regions",
        subscription.subscribe({
          next: ({ data }) => {
            availableRegions.value = data.server_regions;
            useMatchmakingStore().checkLatenies();

            if (!latencyCheckInterval) {
              latencyCheckInterval = setInterval(
                () => {
                  useMatchmakingStore().checkLatenies();
                },
                50 * 60 * 1000,
              );
            }
          },
        }),
      );
    };

    subscribeToAvailableRegions();

    const canCreateMatch = computed(() => {
      const me = useAuthStore().me;
      if (!me) {
        return false;
      }

      return useAuthStore().isRoleAbove(matchCreateRole.value);
    });

    const maxAcceptableLatency = computed(() => {
      return settings.value.find(
        (setting) => setting.name === "public.max_acceptable_latency",
      )?.value;
    });

    const globalStream = ref<object | null>(null);

    const setGlobalStream = async (stream: {
      id: string;
      link: string;
      preview: boolean;
      match_id: string;
    }) => {
      if (!stream) {
        globalStream.value = null;
        return;
      }

      stream.preview = true;
      globalStream.value = stream;
    };

    const brandName = computed(() => {
      return settings.value.find((s) => s.name === "public.brand_name")?.value;
    });

    const logoUrl = computed(() => {
      return settings.value.find((s) => s.name === "public.logo_url")?.value;
    });

    const faviconUrl = computed(() => {
      return settings.value.find((s) => s.name === "public.favicon_url")?.value;
    });

    const showSeparators = computed(() => {
      return (
        settings.value.find((s) => s.name === "public.show_separators")
          ?.value !== "false"
      );
    });

    const showReportIssue = computed(() => {
      return (
        settings.value.find((s) => s.name === "public.show_report_issue")
          ?.value !== "false"
      );
    });

    const githubUrl = computed(() => {
      return (
        settings.value.find((s) => s.name === "public.github_url")?.value ||
        "https://github.com/5stackgg/5stack-panel"
      );
    });

    const isMatchmakingTypeEnabled = (
      matchType: e_match_types_enum,
    ): boolean => {
      return (
        settings.value?.find(
          (setting) => setting.name === `public.matchmaking_${matchType}`,
        )?.value !== "false"
      );
    };

    return {
      settings,
      availableRegions,
      maxAcceptableLatency,
      matchCreateRole,
      customMatchRole,
      canCreateCustomMatch,
      matchmakingAllowed,
      matchmakingEnabled,
      tournamentCreateRole,
      eventCreateRole,
      eventsEnabled,
      supportsDiscordBot,
      supportsGameServerNodes,
      supportsGameServerVersionPinning,
      playerNameRegistration,
      newsEnabled,
      seasonsEnabled,
      leaguesEnabled,
      leagueAllowDivisionRequest,
      teamMinRosterSize,
      teamMaxRosterSize,
      teamMaxSubs,
      requireLoginForLiveStreams,
      newsLabel,
      postNewsRole,
      canPostNews,
      linkedAccountsEnabled,
      faceitEnabled,
      scrimFinderEnabled,
      pluginsEnabled,
      defaultHudMode,
      canCreateMatch,
      currentPluginVersion,
      gameServerPluginRuntime,
      brandName,
      logoUrl,
      faviconUrl,
      showSeparators,
      showReportIssue,
      githubUrl,
      globalStream,
      setGlobalStream,
      isMatchmakingTypeEnabled,
    };
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useApplicationSettingsStore, import.meta.hot),
  );
}
