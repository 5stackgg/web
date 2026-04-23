import { computed, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useRoute, useRouter } from "#app";
import type {
  LocationQuery,
  LocationQueryRaw,
  RouteLocationNormalizedLoaded,
  Router,
} from "vue-router";

type RouteTabQueryOptions = {
  param?: string;
  legacyParams?: string[];
};

type RouteTabOptions = RouteTabQueryOptions & {
  defaultTab: MaybeRefOrGetter<string>;
  tabs: MaybeRefOrGetter<readonly string[]>;
  ready?: MaybeRefOrGetter<boolean>;
};

type RouteLike = Pick<RouteLocationNormalizedLoaded, "path" | "query" | "hash">;

const DEFAULT_TAB_PARAM = "tab";

function tabParam(options?: RouteTabQueryOptions) {
  return options?.param || DEFAULT_TAB_PARAM;
}

function legacyParams(options?: RouteTabQueryOptions) {
  return options?.legacyParams || [];
}

function normalizedTabs(tabs: readonly string[]) {
  return tabs.filter((tab): tab is string => typeof tab === "string" && !!tab);
}

export function getQueryString(
  query: LocationQuery | LocationQueryRaw,
  key: string,
) {
  const value = query[key];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.length > 0 ? first : null;
}

export function getRequestedRouteTab(
  query: LocationQuery | LocationQueryRaw,
  options?: RouteTabQueryOptions,
) {
  const current = getQueryString(query, tabParam(options));

  if (current) {
    return current;
  }

  for (const legacyParam of legacyParams(options)) {
    const legacy = getQueryString(query, legacyParam);
    if (legacy) {
      return legacy;
    }
  }

  return null;
}

export function getRouteTabValue(
  route: Pick<RouteLocationNormalizedLoaded, "query">,
  tabs: readonly string[],
  defaultTab: string,
  options?: RouteTabQueryOptions,
) {
  const availableTabs = normalizedTabs(tabs);
  const fallback = availableTabs.includes(defaultTab)
    ? defaultTab
    : (availableTabs[0] ?? defaultTab);
  const requestedTab = getRequestedRouteTab(route.query, options);

  if (requestedTab && availableTabs.includes(requestedTab)) {
    return requestedTab;
  }

  return fallback;
}

function routeTabQuery(
  currentQuery: LocationQuery | LocationQueryRaw,
  selectedTab: string,
  defaultTab: string,
  options?: RouteTabQueryOptions,
) {
  const param = tabParam(options);
  const reservedParams = new Set([param, ...legacyParams(options)]);
  const query: LocationQueryRaw = {};

  for (const [key, value] of Object.entries(currentQuery)) {
    if (reservedParams.has(key) || value === undefined) {
      continue;
    }

    query[key] = value;
  }

  if (selectedTab && selectedTab !== defaultTab) {
    query[param] = selectedTab;
  }

  return query;
}

function comparableQuery(query: LocationQuery | LocationQueryRaw) {
  return Object.keys(query)
    .filter((key) => query[key] !== undefined)
    .sort()
    .map((key) => {
      const value = query[key];
      const values = Array.isArray(value) ? value : [value];
      return [
        key,
        values.map((item) => (item == null ? "" : String(item))).sort(),
      ] as const;
    });
}

function queriesEqual(
  currentQuery: LocationQuery | LocationQueryRaw,
  nextQuery: LocationQuery | LocationQueryRaw,
) {
  return (
    JSON.stringify(comparableQuery(currentQuery)) ===
    JSON.stringify(comparableQuery(nextQuery))
  );
}

export function replaceRouteTab(
  router: Router,
  route: RouteLike,
  selectedTab: string,
  defaultTab: string,
  options?: RouteTabQueryOptions,
) {
  const nextQuery = routeTabQuery(
    route.query,
    selectedTab,
    defaultTab,
    options,
  );

  if (queriesEqual(route.query, nextQuery)) {
    return Promise.resolve();
  }

  return router.replace({
    path: route.path,
    query: nextQuery,
    hash: route.hash,
  });
}

export function normalizeRouteTab(
  router: Router,
  route: RouteLike,
  tabs: readonly string[],
  defaultTab: string,
  options?: RouteTabQueryOptions,
) {
  const selectedTab = getRouteTabValue(route, tabs, defaultTab, options);
  return replaceRouteTab(router, route, selectedTab, defaultTab, options);
}

export function useRouteTab(options: RouteTabOptions) {
  const route = useRoute();
  const router = useRouter();
  const param = tabParam(options);
  const legacy = legacyParams(options);

  const tabs = computed(() => normalizedTabs(toValue(options.tabs)));
  const defaultTab = computed(() => toValue(options.defaultTab));
  const ready = computed(() =>
    options.ready === undefined ? true : Boolean(toValue(options.ready)),
  );

  const activeTab = computed({
    get() {
      return getRouteTabValue(route, tabs.value, defaultTab.value, options);
    },
    set(value: string) {
      if (!ready.value || !tabs.value.includes(value)) {
        return;
      }

      void replaceRouteTab(router, route, value, defaultTab.value, options);
    },
  });

  watch(
    () => [
      route.query[param],
      ...legacy.map((legacyParam) => route.query[legacyParam]),
      tabs.value.join("\u0000"),
      defaultTab.value,
      ready.value,
    ],
    () => {
      if (!ready.value) {
        return;
      }

      void normalizeRouteTab(
        router,
        route,
        tabs.value,
        defaultTab.value,
        options,
      );
    },
    { immediate: true },
  );

  return activeTab;
}
