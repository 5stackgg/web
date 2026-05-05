import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

// Streamer-rank+ bypass via canViewHighlights so curators keep access
// when the public flag is off.
export default defineNuxtRouteMiddleware(() => {
  if (process.server) return;

  if (!useApplicationSettingsStore().canViewHighlights) {
    return navigateTo("/");
  }
});
