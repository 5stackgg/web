export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    nuxtApp.runWithContext(() => useOffPageToasts());
  });
});
