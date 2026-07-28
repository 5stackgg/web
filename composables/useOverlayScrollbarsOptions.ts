import { computed } from "vue";
import type { PartialOptions } from "overlayscrollbars";

export function useOverlayScrollbarsOptions() {
  const options = computed<PartialOptions>(() => ({
    scrollbars: {
      // The app is dark-only, so the light-on-dark scrollbar theme is fixed.
      theme: "os-theme-light",
      autoHide: "scroll",
    },
  }));

  return { options };
}
