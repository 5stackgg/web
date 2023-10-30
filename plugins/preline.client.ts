import "preline/preline";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("page:finish", () => {
    // @ts-ignore
    HSStaticMethods.autoInit();
  });
});
