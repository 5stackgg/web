import { useStorage } from "@vueuse/core";
import type { RemovableRef } from "@vueuse/core";

// Remembers a list's page-size selection across refreshes, scoped per view
// (so returning to a page keeps the size the user last picked instead of
// resetting to the default). Keyed under the shared 5stack: namespace.
export function usePerPage(key: string, fallback = 10): RemovableRef<number> {
  return useStorage(`5stack:per-page:${key}`, fallback);
}
