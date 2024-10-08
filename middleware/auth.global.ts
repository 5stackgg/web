import { useAuthStore } from "~/stores/AuthStore";

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (process.server) return;

  let hasMe: boolean = useAuthStore().me?.steam_id ? true : false;

  if (!hasMe) {
    hasMe = await useAuthStore().getMe();
  }

  if (!hasMe && to.path !== "/login") {
    return navigateTo(
      `/login${to.path === "/" ? "" : `?redirect=${to.fullPath}`}`,
    );
  }

  if (hasMe && to.path === "/login") {
    if (to.query.redirect) {
      return navigateTo(decodeURIComponent(to.query.redirect as string));
    }
    return navigateTo("/");
  }
});
