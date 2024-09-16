import { defineStore, acceptHMRUpdate } from "pinia";
import { ref, computed } from "vue";
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

    const matchMakingAllowed = computed(() => {
      if (!settings.value) {
        return false;
      }

      const matchMakingSetting = settings.value.find(
        (setting) => setting.name === "public.matchmaking",
      );
      return matchMakingSetting ? matchMakingSetting.value === "true" : true;
    });

    return {
      matchMakingAllowed,
    };
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useApplicationSettingsStore, import.meta.hot),
  );
}
