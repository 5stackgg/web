import { onMounted, onScopeDispose, ref } from "vue";
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

export function useHistoryBack() {
  const router = useRouter();
  const canGoBack = ref(false);

  function refresh() {
    canGoBack.value = previousEntry() !== null;
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
