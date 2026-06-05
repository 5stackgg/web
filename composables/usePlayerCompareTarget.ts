import { ref } from "vue";
import type { ComparisonPlayer } from "./usePlayerComparison";

// Module-level (shared) comparison target so a single "Compare" control on the
// player page drives every tab that supports an overlay — instead of each tab
// owning its own toggle + player picker.
const compareTarget = ref<ComparisonPlayer | null>(null);

export function usePlayerCompareTarget() {
  function setCompareTarget(player: ComparisonPlayer | null) {
    compareTarget.value = player;
  }
  function clearCompareTarget() {
    compareTarget.value = null;
  }
  return { compareTarget, setCompareTarget, clearCompareTarget };
}
