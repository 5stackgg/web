// Tapping a push notification focuses an already-open tab rather than opening
// a second one, so the service worker hands the destination over here for the
// running app to navigate to.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type !== "push-notification-click") {
        return;
      }

      const url = event.data.url;

      // `//evil.test/x` starts with a slash and is a fully qualified URL to
      // somewhere else, so an in-app path has to be a single leading slash.
      if (
        typeof url !== "string" ||
        !url.startsWith("/") ||
        url.startsWith("//")
      ) {
        return;
      }

      void nuxtApp.runWithContext(() => navigateTo(url));
    });
  });
});
