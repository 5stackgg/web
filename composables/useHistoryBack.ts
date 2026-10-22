import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  shallowReactive,
  type Ref,
} from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";

// vue-router keeps the in-app address an entry was reached from in its
// history.state.back, and null on the first entry of a visit (a link from
// another site, a new tab, the installed app's first screen). Stepping back
// only when it is set can never take the viewer off the site.
function previousEntry(): string | null {
  if (!import.meta.client) {
    return null;
  }
  const back = window.history.state?.back;
  return typeof back === "string" ? back : null;
}

function pathOf(location: string) {
  return location.split(/[?#]/)[0].replace(/(.)\/$/, "$1");
}

// An entry with the same path behind it was opened over the page it is on --
// a layer's entry (useBackDismiss pushes one for every sheet and menu on a
// phone) or the page's own address changing -- so it has no earlier page of
// its own, only whatever the page under it had. The answer is kept on the
// entry, which a reload keeps, and by position, which is how an entry finds
// the one it was opened from. It is only good for the address it was worked
// out at: vue-router carries an entry's keys through a replace.
const EARLIER_PAGE = "earlierPage";
const earlierPageAt = new Map<number, boolean>();

type EarlierPage = {
  back: string | null;
  path: string | null;
  value: boolean;
};

function hasEarlierPage() {
  if (!import.meta.client) {
    return false;
  }
  const state = window.history.state ?? {};
  const back = previousEntry();
  const path =
    typeof state.current === "string" ? pathOf(state.current) : null;
  const position = Number(state.position);
  const kept = state[EARLIER_PAGE] as EarlierPage | undefined;
  let answer: boolean;
  if (kept?.back === back && kept?.path === path) {
    answer = kept.value;
  } else {
    const overSamePage =
      back !== null && path !== null && pathOf(back) === path;
    answer = overSamePage
      ? (earlierPageAt.get(position - 1) ?? true)
      : back !== null;
    if (Number.isFinite(position)) {
      const entry: EarlierPage = { back, path, value: answer };
      window.history.replaceState({ ...state, [EARLIER_PAGE]: entry }, "");
    }
  }
  if (Number.isFinite(position)) {
    earlierPageAt.set(position, answer);
  }
  return answer;
}

export function useHistoryBack() {
  const router = useRouter();
  const canGoBack = ref(false);

  function refresh() {
    canGoBack.value = hasEarlierPage();
  }

  onMounted(refresh);
  onScopeDispose(router.afterEach(refresh));

  function back() {
    if (previousEntry() === null) {
      canGoBack.value = false;
      return;
    }
    router.back();
  }

  return { canGoBack, back };
}

const topBarBacks = shallowReactive(new Set<Ref<boolean>>());

// The top bar's Back, on a phone. A page's own back link stands down while it
// shows rather than draw a second arrow, and stays on a page with no top bar.
export function useTopBarBack() {
  const history = useHistoryBack();
  topBarBacks.add(history.canGoBack);
  onScopeDispose(() => topBarBacks.delete(history.canGoBack));
  return history;
}

export function useTopBarBackShown() {
  return computed(() => [...topBarBacks].some((shown) => shown.value));
}

// A "back to the list" link is a real Back when the entry before this one is
// that list, whatever its query: the list comes back with its filters and its
// scroll instead of opening again at the top.
export function useBackToList() {
  const router = useRouter();

  return function stepBackTo(to: RouteLocationRaw) {
    const previous = previousEntry();
    if (
      previous === null ||
      pathOf(previous) !== pathOf(router.resolve(to).path)
    ) {
      return false;
    }
    router.back();
    return true;
  };
}
