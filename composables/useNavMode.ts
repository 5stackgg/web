import { ref, watch } from "vue";
import { useRoute } from "vue-router";

export type NavMode = "play" | "admin";

// Route names (and their children) that live in the left nav's Admin list.
// Opening one flips the nav to Admin; any other page flips it back to Play.
const ADMIN_ROUTES = [
  "awards",
  "seasons",
  "system-alerts",
  "stream-deck",
  "plugins",
  "regions",
  "settings-application",
  "dedicated-servers",
  "game-server-nodes",
  "gpu-nodes",
  "system-logs",
  "system-metrics",
  "system-media-server",
  "database",
  "system-render-queue",
  "fleet-telemetry",
];

export function isAdminRouteName(name: unknown): boolean {
  if (typeof name !== "string") {
    return false;
  }
  return ADMIN_ROUTES.some(
    (route) => name === route || name.startsWith(`${route}-`),
  );
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
