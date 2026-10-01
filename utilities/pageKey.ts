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

  // Same idea, and for the same reason: the map is a PARAMETER of the utility
  // library, not a different page. Keying it on the path made every map switch
  // a full remount — the whole page torn down and rebuilt behind a 520ms slide,
  // the 740px board gone and back, every panel refiring its queries from
  // nothing — for what is really one prop changing. The page watches `mapName`
  // and swaps its contents in place instead.
  if (route.name === "utility-map") {
    return "/utility/:map";
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
