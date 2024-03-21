import {useAuthStore} from "~/stores/AuthStore";

export default defineNuxtRouteMiddleware(async (to, from) => {
    if (process.server) return;

    const me = await useAuthStore().getMe()

    if(!me && to.path !== '/login') {
        return navigateTo('/login')
    }
})