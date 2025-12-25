import { useAuthStore } from "~/stores/AuthStore";
import { toast } from "@/components/ui/toast";

/**
 * Check if a route is in the public whitelist (doesn't require authentication)
 */
function isPublicRoute(path: string): boolean {
  const publicRoutes = [
    "/login",
    "/players",
    "/teams",
    "/tournaments",
    "/watch",
  ];

  // Exact matches
  if (publicRoutes.includes(path)) {
    return true;
  }

  // Dynamic route patterns
  if (path.startsWith("/players/")) {
    return true;
  }

  if (path.startsWith("/teams/")) {
    return true;
  }

  if (path.startsWith("/tournaments/")) {
    // Tournament detail pages are public, but sub-pages like /organizers or /match-options are not
    const tournamentSubPaths = ["/organizers", "/match-options"];
    const isSubPath = tournamentSubPaths.some((subPath) =>
      path.includes(subPath),
    );
    return !isSubPath;
  }

  if (path.startsWith("/matches/")) {
    return true;
  }

  return false;
}

export default defineNuxtRouteMiddleware(async (to, from) => {
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

  if (!hasMe) {
    hasMe = await useAuthStore().getMe();
  }

  // Only redirect to login if route is NOT public and user is not authenticated
  if (!hasMe && !isPublicRoute(to.path) && to.path !== "/login") {
    return navigateTo(`/login${to.path === "/" ? "" : `?redirect=${to.path}`}`);
  }

  if (hasMe && to.path === "/login") {
    if (to.query.redirect) {
      return navigateTo(decodeURIComponent(to.query.redirect as string));
    }
    return navigateTo("/");
  }
});
