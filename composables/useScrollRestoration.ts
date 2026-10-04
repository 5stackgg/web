import { onBeforeUnmount, onMounted, type Ref } from "vue";
import { START_LOCATION } from "vue-router";
import { useScrollFloor } from "~/composables/useScrollFloor";
import { pageKeyWithoutTabQuery } from "~/utilities/pageKey";

// Back/forward scroll restore for the default layout. Its pages scroll a div,
// not the window, so vue-router's saved positions never apply here. Entries are
// keyed by vue-router's `history.state.position`: saved as an entry is left,
// replayed when the browser returns to it (or reloads onto it).
type Entry = {
  path: string;
  top: number;
  // The first `[data-scroll-anchor]` on screen. Content above it usually lands
  // at a different height on the way back (skeletons, late panels), so the
  // restore follows it rather than a raw offset.
  anchor: { id: string; offset: number } | null;
  state: Record<string, unknown>;
};

const STORAGE_KEY = "5stack:history-scroll";
const MAX_ENTRIES = 50;
// The restore follows the page until its target has held still this long (or
// the user takes over); the cap covers a page that never stops moving.
const SETTLE_MS = 2500;
const MAX_RESTORE_MS = 15000;
const INTERRUPTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

let entries: Record<string, Entry> = {};
let scroller: HTMLElement | null = null;
let root: HTMLElement | null = null;
let installed = false;
let currentKey: string | null = null;
let popKey: string | null = null;
let restoringKey: string | null = null;
let navigation = 0;
let stopRestore: (() => void) | null = null;
const snapshots = new Map<string, () => unknown>();

function entryKey(): string | null {
  const position = window.history.state?.position;
  return typeof position === "number" ? String(position) : null;
}

function load(): Record<string, Entry> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function persist() {
  const here = Number(currentKey);
  const keys = Object.keys(entries).sort(
    (a, b) => Math.abs(Number(a) - here) - Math.abs(Number(b) - here),
  );
  for (const key of keys.slice(MAX_ENTRIES)) {
    delete entries[key];
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

function offsetChain(el: HTMLElement) {
  let top = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement) {
    top += n.offsetTop;
  }
  return top;
}

// Where `el` sits in the scroller's content, from layout offsets rather than
// its rect: rows and page sections slide in on enter, and a rect measured
// mid-transition would be off by the animation's translate.
function contentTop(el: HTMLElement) {
  return (
    root!.getBoundingClientRect().top -
    scroller!.getBoundingClientRect().top +
    scroller!.scrollTop +
    offsetChain(el) -
    offsetChain(root!)
  );
}

function findAnchor(): Entry["anchor"] {
  const view = scroller!.getBoundingClientRect();
  for (const el of scroller!.querySelectorAll<HTMLElement>(
    "[data-scroll-anchor]",
  )) {
    const box = el.getBoundingClientRect();
    if (box.bottom > view.top && box.top < view.bottom) {
      return {
        id: el.dataset.scrollAnchor!,
        offset: contentTop(el) - scroller!.scrollTop,
      };
    }
  }
  return null;
}

function save(path: string) {
  if (!currentKey || !scroller || !root) {
    return;
  }
  const state: Record<string, unknown> = {};
  snapshots.forEach((read, id) => {
    state[id] = read();
  });
  entries[currentKey] = {
    path,
    top: scroller.scrollTop,
    anchor: findAnchor(),
    state,
  };
  persist();
}

function restore(entry: Entry, reserve: (height: number) => void) {
  stopRestore?.();
  const el = scroller;
  const content = root;
  if (!el || !content) {
    restoringKey = null;
    return;
  }
  const anchor = entry.anchor;
  const selector = anchor
    ? `[data-scroll-anchor="${CSS.escape(anchor.id)}"]`
    : null;

  let frame = 0;
  let last = -1;
  let movedAt = performance.now();
  // Re-applied every frame while the page fills in.
  const step = () => {
    const target = selector && el.querySelector<HTMLElement>(selector);
    const top = Math.max(
      0,
      Math.round(target ? contentTop(target) - anchor!.offset : entry.top),
    );
    const now = performance.now();
    if (top !== last) {
      last = top;
      movedAt = now;
    } else if (now - movedAt > SETTLE_MS && (target || !selector)) {
      stop();
      return;
    }
    // Not reachable yet: hold the space open so the view can sit there while
    // the content that fills it arrives.
    if (top + el.clientHeight > el.scrollHeight) {
      reserve(top + el.clientHeight - contentTop(content));
    }
    if (Math.abs(el.scrollTop - top) > 1) {
      el.scrollTop = top;
    }
    frame = requestAnimationFrame(step);
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    for (const type of INTERRUPTS) {
      window.removeEventListener(type, stop, true);
    }
    stopRestore = null;
    restoringKey = null;
  };
  const timer = setTimeout(stop, MAX_RESTORE_MS);
  for (const type of INTERRUPTS) {
    window.addEventListener(type, stop, { capture: true, passive: true });
  }
  stopRestore = stop;
  step();
}

// Used once, by the layout that owns the page scroller.
export function useScrollRestorationAnchor(
  scrollerEl: Ref<HTMLElement | null>,
  rootEl: Ref<HTMLElement | null>,
) {
  const router = useRouter();
  const nuxtApp = useNuxtApp();
  const { reserve } = useScrollFloor();

  if (!installed) {
    installed = true;
    entries = load();
    currentKey = entryKey();
    // A reload, or coming back into the app from another site, lands on an
    // entry this tab may have saved before the page went away.
    const visit = performance.getEntriesByType?.("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (
      currentKey &&
      (visit?.type === "reload" || visit?.type === "back_forward") &&
      entries[currentKey]?.path === router.currentRoute.value.path
    ) {
      restoringKey = currentKey;
    }

    // The browser swaps history.state before the router sees the popstate, so
    // this records which entry a back/forward is heading to.
    window.addEventListener("popstate", () => {
      popKey = entryKey();
    });

    // Query-only navigations (tab strips, filters) stay on the entry; a page
    // writing its query on mount mustn't cancel its own restore.
    router.beforeEach((to, from) => {
      if (from === START_LOCATION || to.path === from.path) {
        return;
      }
      stopRestore?.();
      save(from.path);
    });

    router.afterEach((to, from, failure) => {
      if (failure) {
        return;
      }
      const key = entryKey();
      const isPop = key !== null && key === popKey;
      popKey = null;
      // A push cuts off everything that was ahead of it.
      if (!isPop && key !== null && key !== currentKey) {
        for (const saved of Object.keys(entries)) {
          if (Number(saved) >= Number(key)) {
            delete entries[saved];
          }
        }
      }
      currentKey = key;
      // Same page key = the page swaps its content in place (plugin routes,
      // the utility map), so the scroll stays where it is.
      if (
        from === START_LOCATION ||
        to.path === from.path ||
        pageKeyWithoutTabQuery(to) === pageKeyWithoutTabQuery(from)
      ) {
        return;
      }
      restoringKey =
        isPop && key && entries[key]?.path === to.path ? key : null;
      const id = ++navigation;
      // Same moment Nuxt's own scrollBehavior waits for: the new page is in.
      const hook = (nuxtApp as any)._runningTransition
        ? "page:transition:finish"
        : "page:loading:end";
      nuxtApp.hooks.hookOnce(hook, () => {
        requestAnimationFrame(() => {
          if (id !== navigation || !scroller) {
            return;
          }
          const entry = restoringKey ? entries[restoringKey] : null;
          if (entry) {
            restore(entry, reserve);
          } else {
            scroller.scrollTop = 0;
          }
        });
      });
    });
  }

  onMounted(() => {
    scroller = scrollerEl.value;
    root = rootEl.value;
    const entry = restoringKey ? entries[restoringKey] : null;
    if (entry) {
      requestAnimationFrame(() => restore(entry, reserve));
    }
  });

  onBeforeUnmount(() => {
    stopRestore?.();
    scroller = null;
    root = null;
  });
}

// Page state that comes back with its history entry. Returns what was saved
// when this visit is a back/forward (or reload) onto that entry, else null;
// `read` is snapshotted every time the entry is left.
export function useHistoryState<T>(id: string, read: () => T): T | null {
  snapshots.set(id, read);
  onBeforeUnmount(() => {
    // The next instance of the same page may already have registered.
    if (snapshots.get(id) === read) {
      snapshots.delete(id);
    }
  });
  const key = entryKey();
  if (!restoringKey || restoringKey !== key) {
    return null;
  }
  return (entries[key]?.state?.[id] as T | undefined) ?? null;
}

// True from a back/forward until its scroll restore settles or the user takes
// over: async filters landing in that window aren't the user changing them.
export function isRestoringHistory() {
  return restoringKey !== null;
}
