export default defineNuxtPlugin(() => {
  const app = useNuxtApp();
  app.hook("app:mounted", () => {
    document.body.classList.add("pre-loader--fade");

    setTimeout(() => {
      document.body.classList.remove("pre-loader", "pre-loader--fade");
    }, 300);
  });
});
