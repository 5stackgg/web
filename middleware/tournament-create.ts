import { until } from "@vueuse/core";
import { e_player_roles_enum } from "~/generated/zeus";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) {
    return;
  }

  const authStore = useAuthStore();

  if (!authStore.hasCheckedSession) {
    await authStore.getMe();
  }

  if (!authStore.me) {
    return navigateTo(`/login?redirect=${to.path}`);
  }

  const applicationSettings = useApplicationSettingsStore();

  // tournamentCreateRole falls back to `user` until the settings arrive.
  await until(() => applicationSettings.settingsLoaded).toBe(true, {
    timeout: 10000,
  });

  if (
    !applicationSettings.settingsLoaded ||
    !authStore.isRoleAbove(
      applicationSettings.tournamentCreateRole as e_player_roles_enum,
    )
  ) {
    return navigateTo("/tournaments");
  }
});
