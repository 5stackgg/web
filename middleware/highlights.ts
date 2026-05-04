import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

// Gate the public /highlights browse on the operator-controlled
// `public.highlights_public_enabled` setting. Streamer-rank+ users
// (streamer / match-organizer / tournament-organizer / administrator)
// bypass the gate via canViewHighlights so the curation surface stays
// usable even when the public-mode flag is off. Guests + regular
// users get redirected to / when public mode is disabled.
export default defineNuxtRouteMiddleware(() => {
  if (process.server) return;

  if (!useApplicationSettingsStore().canViewHighlights) {
    return navigateTo("/");
  }
});
