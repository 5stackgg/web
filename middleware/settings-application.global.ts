import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";

// Every page under /settings/application is administrator-only (the sidebar
// entry is already gated on isAdmin) — this stops the URL from being reached by
// typing it in. Named to sort after auth.global.ts so a logged-out visitor still
// gets the login bounce with its redirect instead of a silent hop home.
export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) return;

  if (!to.path.startsWith("/settings/application")) return;

  const authStore = useAuthStore();

  if (!authStore.hasCheckedSession) {
    await authStore.getMe();
  }

  // No session at all: auth.global.ts owns that redirect.
  if (!authStore.me) return;

  if (authStore.isRoleAbove(e_player_roles_enum.administrator) === false) {
    return navigateTo("/");
  }
});
