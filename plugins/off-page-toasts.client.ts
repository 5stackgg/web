export default defineNuxtPlugin(() => {
  const app = useNuxtApp();
  app.hook("app:mounted", () => {
    useOffPageToasts();
  });
});
