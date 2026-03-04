import { computed } from "vue";
import type { PartialOptions } from "overlayscrollbars";

export function useOverlayScrollbarsOptions() {
  const colorMode = useColorMode();

  const options = computed<PartialOptions>(() => ({
    scrollbars: {
      theme: colorMode.value === "dark" ? "os-theme-light" : "os-theme-dark",
      autoHide: "scroll",
    },
  }));

  return { options };
}
