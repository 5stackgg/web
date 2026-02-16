import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";

export default defineNuxtRouteMiddleware(() => {
  if (process.server) return;

  if (useAuthStore().isRoleAbove(e_player_roles_enum.administrator) === false) {
    return navigateTo("/");
  }
});
