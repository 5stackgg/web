import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

export default defineNuxtRouteMiddleware((to, from) => {
  if (process.server) {
    return;
  }

  const canCreateMatch = useApplicationSettingsStore().canCreateMatch;

  const currentMatch = useMatchLobbyStore().currentMatch;

  if (
    currentMatch &&
    useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer) === false
  ) {
    return navigateTo(`/matches/${currentMatch.id}`);
  }

  if (!canCreateMatch) {
    return navigateTo("/");
  }

  if (!useApplicationSettingsStore().canCreateCustomMatch) {
    return navigateTo("/play");
  }
});
