import { defineStore, acceptHMRUpdate } from "pinia";
import { ref, computed } from "vue";
import { e_player_roles_enum } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

export const useApplicationSettingsStore = defineStore(
  "applicationSettings",
  () => {
    const settings = ref<Array<{ name: string; value: string }>>([]);

    const subscribeToSettings = async () => {
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

      subscription.subscribe({
        next: ({ data }) => {
          settings.value = data.settings;
        },
      });
    };

    subscribeToSettings();

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

    const matchMakingAllowed = computed(() => {
      if (!settings.value) {
        return false;
      }

      const matchMakingSetting = settings.value.find(
        (setting) => setting.name === "public.matchmaking",
      );
      return matchMakingSetting ? matchMakingSetting.value === "true" : true;
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

    const playerNameRegistration = computed(() => {
      return (
        settings.value?.find(
          (setting) => setting.name === "public.player_name_registration",
        )?.value === "true"
      );
    });

    const availableRegions = ref([]);

    const subscribeToAvailableRegions = async () => {
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
            },
          ],
        }),
      });

      subscription.subscribe({
        next: ({ data }) => {
          availableRegions.value = data.server_regions;
        },
      });
    };

    subscribeToAvailableRegions();

    const csBuildInfo = computed(() => {
      const version = settings.value.find(({ name }) => {
        return name === "cs_version";
      })?.value;

      if (!version) {
        return;
      }

      return JSON.parse(version);
    });

    const canCreateMatch = computed(() => {
      const me = useAuthStore().me;

      if (matchCreateRole.value === e_player_roles_enum.user) {
        return true;
      }

      if (matchCreateRole.value === e_player_roles_enum.verified_user) {
        return [
          e_player_roles_enum.verified_user,
          e_player_roles_enum.match_organizer,
          e_player_roles_enum.tournament_organizer,
          e_player_roles_enum.administrator,
        ].includes(me.role);
      }

      if (matchCreateRole.value === e_player_roles_enum.match_organizer) {
        return [
          e_player_roles_enum.match_organizer,
          e_player_roles_enum.tournament_organizer,
          e_player_roles_enum.administrator,
        ].includes(me.role);
      }

      if (matchCreateRole.value === e_player_roles_enum.tournament_organizer) {
        return [
          e_player_roles_enum.tournament_organizer,
          e_player_roles_enum.administrator,
        ].includes(me.role);
      }

      if (matchCreateRole.value === e_player_roles_enum.administrator) {
        return me.role === e_player_roles_enum.administrator;
      }

      return false;
    });

    return {
      settings,
      availableRegions,
      matchCreateRole,
      matchMakingAllowed,
      tournamentCreateRole,
      supportsDiscordBot,
      supportsGameServerNodes,
      playerNameRegistration,
      csBuildInfo,
      canCreateMatch,
    };
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useApplicationSettingsStore, import.meta.hot),
  );
}
