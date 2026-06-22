import { useAuthStore } from "~/stores/AuthStore";
import { toast } from "@/components/ui/toast";

let checkedMe = false;

function isPublicRoute(path: string): boolean {
  const publicRoutes = [
    "/",
    "/login",
    "/watch",
    "/public-servers",
    "/stats-guide",
  ];

  if (publicRoutes.includes(path)) {
    return true;
  }

  if (path.startsWith("/players")) {
    return true;
  }

  if (path.startsWith("/leaderboard")) {
    return true;
  }

  if (path.startsWith("/teams")) {
    return true;
  }

  if (path.startsWith("/tournaments")) {
    return true;
  }

  if (path.startsWith("/matches")) {
    return true;
  }

  if (path === "/news" || path.startsWith("/news/")) {
    return true;
  }

  if (path.startsWith("/match-popout")) {
    return true;
  }

  if (path.startsWith("/match-replay-popout")) {
    return true;
  }

  if (path.startsWith("/match-3d-replay")) {
    return true;
  }

  if (path.startsWith("/embed/")) {
    return true;
  }

  // Hasura row perms gate clip data by visibility; the routes just
  // need to be reachable without a login bounce.
  if (path === "/highlights" || path.startsWith("/highlights/")) {
    return true;
  }
  if (path.startsWith("/clips/")) {
    return true;
  }

  return false;
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) return;

  if (to.query.error) {
    const errorMessage = Array.isArray(to.query.error)
      ? to.query.error[0]
      : to.query.error;

    if (typeof errorMessage === "string") {
      toast({
        variant: "destructive",
        title: useNuxtApp().$i18n.t("common.error"),
        description: errorMessage,
      });
    }

    // Remove error from URL to prevent showing toast again on refresh
    const query = { ...to.query };
    delete query.error;
    return navigateTo({
      path: to.path,
      query,
    });
  }

  let hasMe: boolean = useAuthStore().me?.steam_id ? true : false;

  if (!checkedMe) {
    checkedMe = true;
    hasMe = await useAuthStore().getMe();
  }

  if (!hasMe && !isPublicRoute(to.path) && to.path !== "/login") {
    return navigateTo(`/login${to.path === "/" ? "" : `?redirect=${to.path}`}`);
  }

  if (hasMe && to.path === "/login") {
    if (to.query.redirect) {
      const redirectPath = decodeURIComponent(to.query.redirect as string);
      if (redirectPath.startsWith("/") && !redirectPath.startsWith("//")) {
        return navigateTo(redirectPath);
      }
    }
    return navigateTo("/");
  }
});
