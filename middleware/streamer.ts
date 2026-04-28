import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";

// Gate the /stream-deck page (and anything else applying this middleware)
// to users with role >= streamer. Mirrors `admin.ts` for administrator;
// the underlying isRoleAbove uses the role-rank table from AuthStore so
// match_organizer / tournament_organizer / administrator pass through.
export default defineNuxtRouteMiddleware(() => {
  if (process.server) return;

  if (useAuthStore().isRoleAbove(e_player_roles_enum.streamer) === false) {
    return navigateTo("/");
  }
});
