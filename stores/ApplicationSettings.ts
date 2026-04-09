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

    const currentPluginVersion = ref<string | null>(null);

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
              limit: 1,
              order_by: [
                {
                  published_at: order_by.desc,
                },
              ],
            },
            {
              version: true,
            },
          ],
        }),
      });

      subscribe(
        "settings:plugin_version",
        subscription.subscribe({
          next: ({ data }) => {
            currentPluginVersion.value = data.plugin_versions.at(0).version;
          },
        }),
      );
    };

    // Watch for user authentication before subscribing
    watch(
      () => useAuthStore().me,
      (me) => {
        if (me) {
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

    const tournamentCreateRole = computed(() => {
      if (!settings.value) {
        return false;
      }

      const create_tournaments_role = settings.value.find(
        (setting) => setting.name === "public.create_tournaments_role",
      );

      return create_tournaments_role?.value || e_player_roles_enum.user;
    });

    const matchmakingAllowed = computed(() => {
      if (!settings.value) {
        return false;
      }

      const matchMakingSetting = settings.value.find(
        (setting) => setting.name === "public.matchmaking",
      );

      const matchmakingEnabled = matchMakingSetting
        ? matchMakingSetting.value === "true"
        : true;

      if (!matchmakingEnabled) {
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

    const playerNameRegistration = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.player_name_registration",
        )?.value === "true"
      );
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

    const canAddWithoutInvite = computed(() => {
      const lineupAddWithoutInviteRole = settings.value.find(
        (setting) => setting.name === "public.lineup_add_without_invite",
      )?.value;

      if (!lineupAddWithoutInviteRole) {
        return true;
      }

      return useAuthStore().isRoleAbove(lineupAddWithoutInviteRole);
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
      matchmakingAllowed,
      tournamentCreateRole,
      supportsDiscordBot,
      supportsGameServerNodes,
      supportsGameServerVersionPinning,
      playerNameRegistration,
      canCreateMatch,
      currentPluginVersion,
      canAddWithoutInvite,
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
