import { useAppUpdate } from "~/composables/useAppUpdate";

// Nuxt polls builds/latest.json every experimental.checkOutdatedBuildInterval.
export default defineNuxtPlugin((nuxtApp) => {
  const { markAvailable } = useAppUpdate();

  nuxtApp.hook("app:manifest:update", markAvailable);
});
