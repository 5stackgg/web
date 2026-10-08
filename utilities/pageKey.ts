const TAB_QUERY_KEYS = new Set(["tab", "mode"]);

export function pageKeyWithoutTabQuery(route: {
  name?: string | symbol | null;
  path: string;
  query: Record<string, unknown>;
  hash?: string;
  meta?: { persistQueryKeys?: string[] };
}) {
  // A plugin owns every route under its slug, so its key stops at the slug:
  // the plugin's own routes then swap views inside a mounted remote instead of
  // remounting it (and re-fetching its data) on every navigation — the same
  // reason tab/mode query keys are excluded below.
  const plugin = route.path.match(/^\/apps\/([^/]+)/);
  if (plugin) {
    return `/apps/${plugin[1]}`;
  }

  // Same idea, and for the same reason. The maps index and a map are two
  // views inside one shell (`pages/utility.vue`), which holds the maps rail:
  // keyed on the path, going from the index to a map tore the shell down and
  // put the rail back somewhere else. With one key for both, the shell stays
  // mounted and only what is inside it changes. The map itself is a PARAMETER
  // of the library, not a different page -- the shell keys its own outlet so
  // that a map switch is one prop changing rather than a remount (see
  // `utilityOutletKey`).
  if (route.name === "utility" || route.name === "utility-map") {
    return "/utility";
  }

  const query = new URLSearchParams();
  const persisted = new Set([
    ...TAB_QUERY_KEYS,
    ...(route.meta?.persistQueryKeys ?? []),
  ]);

  Object.keys(route.query)
    .filter((key) => !persisted.has(key))
    .sort()
    .forEach((key) => {
      const value = route.query[key];
      const values = Array.isArray(value) ? value : [value];

      values.forEach((item) => {
        if (item == null) {
          return;
        }

        query.append(key, String(item));
      });
    });

  const queryString = query.toString();
  return `${route.path}${queryString ? `?${queryString}` : ""}${route.hash || ""}`;
}

/**
 * The key of the outlet inside the utility shell. Every map is the same key,
 * so switching maps swaps the page's contents in place: keyed on the path, the
 * whole page was torn down and rebuilt behind a 520ms slide, the board gone and
 * back, every panel refiring its queries from nothing.
 */
export function utilityOutletKey(route: {
  name?: string | symbol | null;
  path: string;
}) {
  return route.name === "utility-map" ? "/utility/:map" : route.path;
}
