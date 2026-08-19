import { watch } from "vue";

// The app icon's badge follows the bell while the app is open, and the service
// worker sets it from the push payload while it is closed -- so catching up
// in-app clears what a night of pushes put there.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) {
      return;
    }

    const { unreadNotificationCount } = useNotificationBadge();

    watch(
      unreadNotificationCount,
      (count) => {
        void (
          count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()
        ).catch(() => {
          // Best-effort: some platforms refuse badging outside an installed app.
        });
      },
      { immediate: true },
    );
  });
});
