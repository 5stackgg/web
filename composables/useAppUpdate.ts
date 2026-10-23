import { computed } from "vue";

// Set once Nuxt finds a newer build than the one this tab runs. Nuxt reloads
// at the next navigation on its own; a tab left on one page is told instead.
export function useAppUpdate() {
  const available = useState("app-update-available", () => false);
  const dismissed = useState("app-update-dismissed", () => false);

  return {
    available,
    visible: computed(() => available.value && !dismissed.value),
    markAvailable() {
      available.value = true;
    },
    dismiss() {
      dismissed.value = true;
    },
    refresh() {
      window.location.reload();
    },
  };
}
