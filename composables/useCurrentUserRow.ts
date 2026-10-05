import {
  computed,
  inject,
  provide,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from "vue";

// Row + sticky-cell highlight classes for the currently logged-in player's
// row in a lineup-stats table. Tac-amber accent, kept intentionally subtle
// (low-alpha bg + 2px left rail on the sticky cell).
const ROW_CLASS = "";

const STICKY_CELL_CLASS =
  "bg-card group-hover:bg-muted shadow-[inset_2px_0_0_hsl(var(--tac-amber)/0.55),3px_0_6px_-3px_hsl(0_0%_0%/0.7)]";

// The viewer's own team in the same tables: its header cell gets the rail
// their row has, and its name the accent.
export function teamHeadClass(lineup: any) {
  return lineup?.is_on_lineup
    ? "text-[hsl(var(--tac-amber))] shadow-[inset_2px_0_0_hsl(var(--tac-amber)/0.55),3px_0_6px_-3px_hsl(0_0%_0%/0.7)]"
    : "shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]";
}

// Lets a surface pin a different player's row (e.g. the profile being viewed)
// instead of the logged-in user's.
const FOCUS_ROW_STEAM_ID: InjectionKey<Ref<string | null>> =
  Symbol("focusRowSteamId");

export function provideFocusRow(steamId: Ref<string | null>) {
  provide(FOCUS_ROW_STEAM_ID, steamId);
}

export function useCurrentUserRow(): {
  isCurrentUser: (member: any) => boolean;
  rowClass: (member: any) => string;
  stickyCellClass: (member: any) => string;
  meSteamId: ComputedRef<string | null>;
} {
  const focusSteamId = inject(FOCUS_ROW_STEAM_ID, null);

  const meSteamId = computed(() => {
    if (focusSteamId) return focusSteamId.value;
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
