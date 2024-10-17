import { defineStore, acceptHMRUpdate } from "pinia";
import { ref, computed } from "vue";
import { e_player_roles_enum } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

export const useApplicationSettingsStore = defineStore(
  "applicationSettings",
  () => {
    const hasUpdates = ref(false);
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

    const watchSettings = watch(settings, () => {
      const versionUpdates = settings.value?.filter(
        (setting: { name: string }) => {
          return ["api", "web", "game-server-node"].includes(setting.name);
        },
      );

      hasUpdates.value = versionUpdates.find(({ value }) => {
        const { current, latest } = JSON.parse(value);

        console.info(`neds update`, current !== latest);
        return current !== latest;
      });
    });

    // Make sure to stop watching when the component is unmounted
    onUnmounted(() => {
      if (watchSettings) {
        watchSettings();
      }
    });

    return {
      hasUpdates,
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
