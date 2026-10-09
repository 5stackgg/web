import { onScopeDispose, watch } from "vue";
import {
  useRouter,
  type HistoryState,
  type RouteLocationNormalized,
  type Router,
} from "vue-router";
import {
  addressCloseDelta,
  carriesAddress,
  layerClosed,
  layerNavigated,
  layerOpened,
  type LayerEntry,
} from "~/utilities/backDismiss";

const OPENED_AT = "OpenedAt";

function position() {
  return import.meta.client
    ? Number(window.history.state?.position ?? Number.NaN)
    : Number.NaN;
}

// Where the things that live in the address were opened (`openedHere`). They
// ride along onto a layer's entry, or they are lost the moment something
// opens over what they describe.
function notes() {
  const state = (window.history.state ?? {}) as HistoryState;
  return Object.fromEntries(
    Object.entries(state).filter(([key]) => key.endsWith(OPENED_AT)),
  ) as HistoryState;
}

interface Tracked {
  // The entry the router last came to rest on.
  last: { position: number; layer: boolean; notes: HistoryState };
  // The navigation that is on its way, if one is.
  pending: RouteLocationNormalized | null;
  // The layers' entries that an open layer is standing on.
  held: Set<number>;
}

const tracked = new WeakMap<Router, Tracked>();

function track(router: Router) {
  const known = tracked.get(router);
  if (known) {
    return known;
  }
  const here = () => ({
    position: position(),
    layer: !!window.history.state?.backLayer,
    notes: notes(),
  });
  const state: Tracked = { last: here(), pending: null, held: new Set() };
  tracked.set(router, state);

  // By the time a guard runs for Back the browser is already on the entry it
  // went to, so its position is the destination's. Sending the navigation to
  // the address it came from, as a replace, rewrites that entry in place: the
  // page never sees the old address in between.
  router.beforeEach((to, from) => {
    state.pending = to;
    if (
      !carriesAddress(
        state.last,
        position(),
        to.path === from.path,
        to.fullPath === from.fullPath,
      )
    ) {
      return;
    }
    return {
      path: from.path,
      query: from.query,
      hash: from.hash,
      replace: true,
      state: state.last.notes,
    };
  });
  router.afterEach((to) => {
    if (state.pending === to) {
      state.pending = null;
    }
    state.last = here();
  });
  router.onError((_error, to) => {
    if (state.pending === to) {
      state.pending = null;
    }
  });
  return state;
}

// Resolves once whatever the page itself asked the router for has landed. A
// click that opens or closes a layer often navigates too (it opens a lineup,
// switches a tab), and the router keeps only the newest of two navigations
// started together -- so the layer waits its turn, and then goes by where the
// history actually is.
function settled(state: Tracked) {
  return new Promise<void>((resolve) => {
    const since = Date.now();
    const check = () => {
      if (!state.pending || Date.now() - since > 600) {
        resolve();
        return;
      }
      setTimeout(check, 16);
    };
    setTimeout(check, 0);
  });
}

// Every layer's pushes and steps back go through one line, in the order they
// were asked for. Two layers changing in the same tick (one view closing as
// another opens) would otherwise hand the router a push and a traversal at
// once.
let line: Promise<unknown> = Promise.resolve();

function inTurn(job: () => Promise<unknown>) {
  line = line.then(job, job);
  return line;
}

// Menus and popovers only take a history entry where Back is a gesture people
// reach for to close them: on a phone. With a mouse they close on a click
// outside, and an entry per menu would be noise in the history.
export function backClosesMenus() {
  return (
    import.meta.client &&
    !!window.matchMedia?.("(pointer: coarse)").matches
  );
}

/**
 * Makes the Back button close something that is open over the page before it
 * leaves the page. Opening pushes a history entry at the same address;
 * Back past it calls `close`; closing it any other way takes the entry back
 * out. See utilities/backDismiss.ts for the rules.
 *
 * Not for what is open because the address says so: that already has the
 * entry that opened it. See `openedHere` and `stepOutOf`.
 */
export function useBackDismiss(
  isOpen: () => boolean,
  close: () => void,
  options: { enabled?: () => boolean } = {},
) {
  if (!import.meta.client) {
    return;
  }
  const router = useRouter();
  const state = track(router);
  let entry: LayerEntry = null;

  function take(at: number) {
    entry = at;
    state.held.add(at);
  }

  function drop() {
    if (entry !== null) {
      state.held.delete(entry);
    }
    entry = null;
  }

  async function enter() {
    await settled(state);
    if (!isOpen()) {
      return;
    }
    const at = position();
    const onSpare = !!window.history.state?.backLayer && !state.held.has(at);
    const op = layerOpened(entry, options.enabled?.() ?? true, onSpare);
    if (op === "take") {
      take(at);
    }
    if (op !== "push") {
      return;
    }
    const route = router.currentRoute.value;
    // A push the router dropped for a newer navigation made no entry.
    const failed = await router.push({
      path: route.path,
      query: route.query,
      hash: route.hash,
      force: true,
      state: { ...notes(), backLayer: true },
    });
    if (!failed) {
      take(position());
    }
  }

  // Resolves once the step back has landed, so whatever is next in line
  // starts from the entry it expects.
  function stepBack() {
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        stopWaiting();
        resolve();
      };
      const stopWaiting = router.afterEach(done);
      const timer = setTimeout(done, 500);
      router.back();
    });
  }

  async function leave() {
    await settled(state);
    if (isOpen()) {
      return;
    }
    const op = layerClosed(entry, position());
    drop();
    if (op === "back") {
      await stepBack();
    }
  }

  watch(isOpen, (open) => {
    void inTurn(open ? enter : leave);
  });

  const stop = router.afterEach(() => {
    if (layerNavigated(entry, position()) !== "dismiss") {
      return;
    }
    drop();
    if (isOpen()) {
      close();
    }
  });

  onScopeDispose(() => {
    stop();
    drop();
  });
}

/**
 * History state for the navigation that opens something whose being open is
 * in the address -- `?lineup=`, `?spot=`, `?collection=`, `?execute=`. It
 * notes where the entry is, which is what tells the page's own Back that the
 * entry is ours to step back out of.
 */
export function openedHere(name: string) {
  return { [name + OPENED_AT]: position() + 1 };
}

// For taking it out of the address by hand, which leaves the entry where it
// is: the entry must stop claiming something was opened there.
export function notOpenedHere(name: string) {
  return { [name + OPENED_AT]: null };
}

/**
 * The page's own Back on something that lives in the address: the browser's
 * Back when it was opened here, so the two never leave a spare entry behind
 * each other. Arrived at by link there is nothing of ours to step back to,
 * and `otherwise` takes it out of the address instead.
 */
export function stepOutOf(router: Router, name: string, otherwise: () => void) {
  const at = import.meta.client
    ? window.history.state?.[name + OPENED_AT]
    : null;
  const delta = addressCloseDelta(
    typeof at === "number" ? at : null,
    position(),
  );
  if (delta === null) {
    otherwise();
    return;
  }
  router.go(delta);
}
