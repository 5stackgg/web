import alertStore from "~/stores/AlertStore";
import { AlertStatuses } from "~/constants/AlertStatuses";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("apollo:error", (error) => {
    if (error.graphQLErrors) {
      for (const graphqlError of error.graphQLErrors) {
        alertStore().add({
          duration: 5000,
          severity: AlertStatuses.Error,
          title: graphqlError.message,
        });
      }
    }
  });
});
