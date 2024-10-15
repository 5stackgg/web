import { defineStore, acceptHMRUpdate } from "pinia";
import { ref, computed } from "vue";
import { e_player_roles_enum } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

export const useApplicationSettingsStore = defineStore(
  "applicationSettings",
  () => {
    const settings = ref(undefined);

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

    const availableRegions = ref([]);

    const subscribeToAvailableRegions = async () => {
      const subscription = getGraphqlClient().subscribe({
        query: generateSubscription({
          e_server_regions: [
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
            },
          ],
        }),
      });

      subscription.subscribe({
        next: ({ data }) => {
          availableRegions.value = data.e_server_regions;
        },
      });
    };

    subscribeToAvailableRegions();

    return {
      availableRegions,
      matchCreateRole,
      matchMakingAllowed,
      tournamentCreateRole,
    };
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useApplicationSettingsStore, import.meta.hot),
  );
}
