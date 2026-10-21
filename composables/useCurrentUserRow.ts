import {
  computed,
  inject,
  provide,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from "vue";

// The logged-in player's row in a lineup-stats table, tinted end to end in
// tac-amber with a 2px rail on its sticky cell. The sticky cell lays the tint
// as an image over the card colour: it has to stay opaque over scrolled cells,
// and a `background` shorthand would undo the tables' padding-box clip.
const ROW_CLASS =
  "bg-[hsl(var(--tac-amber)/0.04)] hover:bg-[hsl(var(--tac-amber)/0.07)]";

const STICKY_CELL_CLASS =
  "bg-card bg-[linear-gradient(hsl(var(--tac-amber)/0.04),hsl(var(--tac-amber)/0.04))] group-hover:bg-[linear-gradient(hsl(var(--tac-amber)/0.07),hsl(var(--tac-amber)/0.07))] shadow-[inset_2px_0_0_hsl(var(--tac-amber)/0.45),3px_0_6px_-3px_hsl(0_0%_0%/0.7)]";

// A team's header cell in the same tables. Every team's is plain: the
// viewer's own row already says which side they are on.
export const TEAM_HEAD_CLASS = "shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]";

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
