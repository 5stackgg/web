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
    "/faq",
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

  // The library is public: a signed-out visitor gets Public lineups and the
  // read-only views. Everything that needs an identity (Mine/Team/Saved,
  // practice, voting, authoring) is hidden by the page, not by the route.
  if (path === "/utility" || path.startsWith("/utility/")) {
    return true;
  }

  if (path.startsWith("/matches")) {
    // ...except the camera pages. Your own used to be reachable with a minted
    // token instead of a login, which is exactly what was retired: the phone
    // scanning the QR now signs in, and the API takes the player's identity
    // from the session rather than the URL. The organizer grid never had a
    // token to begin with.
    return !/^\/matches\/[^/]+\/camera(-admin)?\/?$/.test(path);
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

  // Plugins are reachable without a login bounce; the loader page
  // (pages/apps/[slug].vue) enforces per-plugin role and only mounts the remote
  // for viewers who may see it. Public (null required_role) plugins must be
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

  const authStore = useAuthStore();

  let hasMe: boolean = authStore.me?.steam_id ? true : false;

  if (!checkedMe) {
    checkedMe = true;

    const verifying = authStore.getMe();

    // A public route renders the same whether or not the session turns out to
    // be alive -- the only thing `hasMe` decides below is the bounce to
    // /login, and that branch is unreachable here. Awaiting anyway put a full
    // Hasura round-trip in front of the very first route resolve, and the
    // pre-loader spinner covers all of it (see plugins/preloader.client.ts,
    // which reveals on app:suspense:resolve). So let it verify in the
    // background and paint from the cached identity.
    //
    // /login is deliberately NOT in this fast path: it uses `hasMe` to send an
    // already-signed-in visitor onward, so it has to know the real answer.
    // Protected routes keep awaiting too -- a cached `me` is a paint hint, not
    // proof of a session, and must never wave someone onto a guarded page.
    if (isPublicRoute(to.path) && to.path !== "/login") {
      void verifying;
    } else {
      hasMe = await verifying;
    }
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
