import { useAuthStore } from "~/stores/AuthStore";
import { toast } from "@/components/ui/toast";

let checkedMe = false;

function isPublicRoute(path: string): boolean {
  const publicRoutes = [
    "/",
    "/login",
    "/play",
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

  if (path === "/scrims" || path.startsWith("/scrims/")) {
    return true;
  }

  if (path.startsWith("/tournaments")) {
    return true;
  }

  if (path.startsWith("/matches")) {
    return true;
  }

  if (path.startsWith("/draft-room/") && !path.endsWith("/edit")) {
    return true;
  }

  if (path === "/news" || path.startsWith("/news/")) {
    return true;
  }

  // Event data is row-gated by the visibility column (Private/Friends/
  // Public) in Hasura and by the same SQL functions on the media routes;
  // the pages just need to be reachable without a login bounce.
  if (path === "/events" || path.startsWith("/events/")) {
    return true;
  }

  if (path.startsWith("/match-popout")) {
    return true;
  }

  if (path.startsWith("/embed/")) {
    return true;
  }

  // Custom pages are reachable without a login bounce; the loader page
  // (pages/apps/[slug].vue) enforces per-page role and only mounts the remote
  // for viewers who may see it. Public (null required_role) pages must be
  // reachable by guests.
  if (path.startsWith("/apps/")) {
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
