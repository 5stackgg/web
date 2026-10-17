// Opened from anywhere in the app: ⌘K, the left nav and the top nav. Kept apart
// from the search itself so the navs do not load it.
const open = ref(false);

export function useGlobalSearchOpen() {
  return open;
}
