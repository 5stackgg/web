import { installTwitchLinkResult } from "~/composables/useTwitchLinkResult";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    nuxtApp.runWithContext(() => installTwitchLinkResult());
  });
});
