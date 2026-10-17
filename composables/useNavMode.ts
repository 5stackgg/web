import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { adminEntryForRoute } from "~/composables/adminEntries";

export type NavMode = "play" | "admin";

// Opening an admin page flips the nav to Admin; any other page flips it back
// to Play. The pages come from adminEntries (the Overview at `admin` too),
// matched by exact route name; only entries marked `children` also claim
// their `<route>-*` routes, so the public /awards/[id] (`awards-id`) stays in
// Play.
export function isAdminRouteName(name: unknown): boolean {
  return !!adminEntryForRoute(name);
}

const mode = ref<NavMode>("play");

function setMode(next: NavMode) {
  mode.value = next;
}

/**
 * The left nav shows one list at a time. The route decides which; the switch
 * overrides it until the next navigation.
 */
export function useNavMode() {
  const route = useRoute();

  watch(
    () => route.name,
    (name) => {
      setMode(isAdminRouteName(name) ? "admin" : "play");
    },
    { immediate: true },
  );

  return {
    mode,
    setMode,
    toggle: () => setMode(mode.value === "admin" ? "play" : "admin"),
  };
}
