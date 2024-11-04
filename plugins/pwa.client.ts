import { registerSW } from "virtual:pwa-register";

export default defineNuxtPlugin(() => {
  registerSW({ immediate: true });
});
