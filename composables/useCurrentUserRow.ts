import { computed, type ComputedRef } from "vue";

// Row + sticky-cell highlight classes for the currently logged-in player's
// row in a lineup-stats table. Tac-amber accent, kept intentionally subtle
// (low-alpha bg + 2px left rail on the sticky cell).
const ROW_CLASS = "";

const STICKY_CELL_CLASS =
  "bg-card group-hover:bg-muted shadow-[inset_2px_0_0_hsl(var(--tac-amber)/0.55),3px_0_6px_-3px_hsl(0_0%_0%/0.7)]";

export function useCurrentUserRow(): {
  isCurrentUser: (member: any) => boolean;
  rowClass: (member: any) => string;
  stickyCellClass: (member: any) => string;
  meSteamId: ComputedRef<string | null>;
} {
  const meSteamId = computed(() => {
    const id = useAuthStore().me?.steam_id;
    return id ? String(id) : null;
  });

  function isCurrentUser(member: any): boolean {
    const my = meSteamId.value;
    if (!my) return false;
    const theirs = member?.steam_id;
    if (!theirs) return false;
    return String(theirs) === my;
  }

  return {
    isCurrentUser,
    rowClass: (member) => (isCurrentUser(member) ? ROW_CLASS : ""),
    stickyCellClass: (member) =>
      isCurrentUser(member) ? STICKY_CELL_CLASS : "",
    meSteamId,
  };
}
