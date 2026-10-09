import { nextTick, onScopeDispose, watch } from "vue";
import {
  useRouter,
  type HistoryState,
  type RouteLocationNormalized,
  type Router,
} from "vue-router";
import {
  addressCarried,
  addressCloseDelta,
  addressRaised,
  layerClosed,
  layerNavigated,
  layerOpened,
  type LayerEntry,
  type RestedEntry,
} from "~/utilities/backDismiss";

const OPENED_AT = "OpenedAt";

function position() {
  return import.meta.client
    ? Number(window.history.state?.position ?? Number.NaN)
    : Number.NaN;
}

function opened() {
  const state = (window.history.state ?? {}) as HistoryState;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(state)) {
    if (key.endsWith(OPENED_AT) && typeof value === "number") {
      out[key.slice(0, -OPENED_AT.length)] = value;
    }
  }
  return out;
}

// As history state for an entry at `at`: what was opened above it is not
// true of it.
function notes(from: Record<string, number>, at = Number.POSITIVE_INFINITY) {
  const state: HistoryState = {};
  for (const [name, openedAt] of Object.entries(from)) {
    if (openedAt <= at) {
      state[name + OPENED_AT] = openedAt;
    }
  }
  return state;
}

type Owner = { canReopen: () => boolean; reopen: () => void };

interface Tracked {
  last: RestedEntry;
  pending: RouteLocationNormalized | null;
  // The layers' entries that an open layer is standing on.
  held: Set<number>;
  // The layers Forward can put back, by the id their entries carry.
  owners: Map<string, Owner>;
}

const tracked = new WeakMap<Router, Tracked>();

function track(router: Router) {
  const known = tracked.get(router);
  if (known) {
    return known;
  }
  const here = (): RestedEntry => ({
    position: position(),
    layer: !!window.history.state?.backLayer,
    opened: opened(),
  });
  const state: Tracked = {
    last: here(),
    pending: null,
    held: new Set(),
    owners: new Map(),
  };
  tracked.set(router, state);

  // By the time a guard runs for Back the browser is already on the entry it
  // went to, so its position is the destination's. Sending the navigation to
  // the address it came from, as a replace, rewrites that entry in place: the
  // page never sees the old address in between.
  router.beforeEach((to, from) => {
    state.pending = to;
    const samePage = to.path === from.path;
    const arriving = here();
    const closed = addressCarried(state.last, arriving.position, samePage);
    const opens = addressRaised(state.last, arriving, samePage);
    if (closed === null && opens === null) {
      return;
    }
    const query = { ...from.query };
    for (const name of closed ?? []) {
      delete query[name];
    }
    for (const name of opens ?? []) {
      query[name] = to.query[name];
    }
    const target = { path: from.path, query, hash: from.hash };
    if (router.resolve(target).fullPath === to.fullPath) {
      return;
    }
    return {
      ...target,
      replace: true,
      state: closed ? notes(state.last.opened, arriving.position) : {},
    };
  });

  /**
   * A layer's entry with no layer to show for it is a press of Back or
   * Forward that does nothing: the address is the same on both sides of it.
   * It is left behind whenever the page is left, reloaded or stepped back
   * from with a layer open. Arrived at, the layer is put back if it is one
   * that can be (Forward, onto a raised sheet); otherwise the history goes
   * on the way it was going. Forward with nothing beyond it comes back,
   * which leaves the visitor where they were rather than on a dead entry.
   */
  async function sweep(direction: number, at: number) {
    await settled(state);
    await nextTick();
    const entry = window.history.state;
    if (position() !== at || !entry?.backLayer || state.held.has(at)) {
      return;
    }
    const owner = state.owners.get(String(entry.backLayer));
    if (direction > 0 && owner?.canReopen()) {
      owner.reopen();
      return;
    }
    if (direction > 0 && typeof entry.forward === "string") {
      router.forward();
    } else if (typeof entry.back === "string") {
      router.back();
    }
  }

  router.afterEach((to, from) => {
    if (state.pending === to) {
      state.pending = null;
    }
    const before = state.last;
    // vue-router keeps an entry's state through a replace, so a layer's
    // entry replaced by another page would go on claiming to be a layer's.
    if (
      before.layer &&
      position() === before.position &&
      to.path !== from.path &&
      window.history.state?.backLayer
    ) {
      window.history.replaceState(
        { ...window.history.state, backLayer: false },
        "",
      );
    }
    state.last = here();
    if (state.last.layer && state.last.position !== before.position) {
      void sweep(state.last.position - before.position, state.last.position);
    }
  });
  router.onError((_error, to) => {
    if (state.pending === to) {
      state.pending = null;
    }
  });
  if (state.last.layer) {
    void sweep(0, state.last.position);
  }
  return state;
}

// A click that opens or closes a layer often navigates too (it opens a
// lineup, switches a tab), and the router keeps only the newest of two
// navigations started together -- so the layer waits for the page's to land.
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

// Two layers changing in the same tick (one view closing as another opens)
// would otherwise hand the router a push and a traversal at once.
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
 * Makes Back close something open over the page before it leaves the page;
 * the rules are in utilities/backDismiss.ts. `id` and `reopen` are for a
 * layer Forward can put back.
 *
 * Not for what is open because the address says so, which already has the
 * entry that opened it: see `openedHere` and `stepOutOf`.
 */
export function useBackDismiss(
  isOpen: () => boolean,
  close: () => void,
  options: {
    enabled?: () => boolean;
    id?: string;
    reopen?: () => void;
  } = {},
) {
  if (!import.meta.client) {
    return;
  }
  const router = useRouter();
  const state = track(router);
  const enabled = () => options.enabled?.() ?? true;
  let entry: LayerEntry = null;

  const owner: Owner | null =
    options.id && options.reopen
      ? { canReopen: () => enabled() && !isOpen(), reopen: options.reopen }
      : null;
  if (owner && options.id) {
    state.owners.set(options.id, owner);
  }

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
    const op = layerOpened(entry, enabled(), onSpare);
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
      state: { ...notes(opened()), backLayer: options.id ?? true },
    });
    if (!failed) {
      take(position());
    }
  }

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
    if (options.id && state.owners.get(options.id) === owner) {
      state.owners.delete(options.id);
    }
  });
}

// History state for the push that opens something by address (`?lineup=`,
// `?spot=`, ...): it notes where the entry is, which is what tells the page's
// own Back that the entry is ours to step back out of.
export function openedHere(name: string) {
  return { [name + OPENED_AT]: position() + 1 };
}

// Taken out of the address by hand, the entry stays and must stop claiming
// something was opened there.
export function notOpenedHere(name: string) {
  return { [name + OPENED_AT]: null };
}

// The page's own Back on something opened by address: the browser's Back
// when it was opened here, and `otherwise` when it was arrived at by link.
export function stepOutOf(router: Router, name: string, otherwise: () => void) {
  if (!import.meta.client) {
    return;
  }
  track(router);
  const at = window.history.state?.[name + OPENED_AT];
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
