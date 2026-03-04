import { OverlayScrollbarsComponent } from "overlayscrollbars-vue";
import "overlayscrollbars/overlayscrollbars.css";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component("OverlayScrollbars", OverlayScrollbarsComponent);
});
