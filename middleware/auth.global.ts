import { useAuthStore } from "~/stores/AuthStore";

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (process.server) return;

  let hasMe: boolean = useAuthStore().me?.steam_id ? true : false;

  if (!hasMe) {
    hasMe = await useAuthStore().getMe();
  }

  if (!hasMe && to.path !== "/login") {
    return navigateTo("/login");
  }

  if (hasMe && to.path === "/login") {
    return navigateTo("/");
  }
});
