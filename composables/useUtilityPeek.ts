import { ref, shallowRef } from "vue";

// One peek on the page at a time: whichever row or marker asked last holds it.
// Held per asker, not per lineup -- the list and the radar both peek the same
// lineup, and keyed by lineup both would open at once.
const holder = ref<string | null>(null);
let warmUntil = 0;

// A peek closed this recently still counts as up, so leaving the list for a
// moment and coming back does not start the wait over.
const WARM_FOR_MS = 600;

// The radar the page is showing, so a peek -- from a marker or from a row --
// can be placed off the throw it is about.
export type UtilityPeekBoard = {
  rect: () => DOMRect | null;
  line: (lineupId: string) => DOMRect | null;
};

const board = shallowRef<UtilityPeekBoard | null>(null);

let owners = 0;

export function useUtilityPeek() {
  return {
    holder,
    board,
    isWarm: () => holder.value !== null || Date.now() < warmUntil,
    claimOwner: () => `peek-${++owners}`,
    show(owner: string) {
      holder.value = owner;
    },
    // `cool`: the next peek waits the full delay, as if none had been up.
    hide(owner: string, cool = false) {
      if (holder.value !== owner) {
        return;
      }
      holder.value = null;
      warmUntil = cool ? 0 : Date.now() + WARM_FOR_MS;
    },
    registerBoard(entry: UtilityPeekBoard) {
      board.value = entry;
      return () => {
        if (board.value === entry) {
          board.value = null;
        }
      };
    },
  };
}
