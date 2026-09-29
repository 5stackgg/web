import { until } from "@vueuse/core";
import { e_player_roles_enum } from "~/generated/zeus";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (process.server) {
    return;
  }

  const router = useRouter();

  // A redirect issued after an await would pull the player off whatever page
  // they moved on to while this navigation was still pending.
  const superseded = () => router.currentRoute.value !== from;

  const authStore = useAuthStore();

  // /tournaments is a public route, so nothing upstream has waited out the
  // verification of a cached `me`.
  await authStore.getMe();

  if (superseded()) {
    return;
  }

  if (!authStore.me) {
    return navigateTo(`/login?redirect=${to.path}`);
  }

  const applicationSettings = useApplicationSettingsStore();

  // tournamentCreateRole falls back to `user` until the settings arrive.
  await until(() => applicationSettings.settingsLoaded).toBe(true, {
    timeout: 10000,
  });

  if (superseded()) {
    return;
  }

  if (
    !applicationSettings.settingsLoaded ||
    !authStore.isRoleAbove(
      applicationSettings.tournamentCreateRole as e_player_roles_enum,
    )
  ) {
    return navigateTo("/tournaments");
  }
});
