import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import type { FieldNode, OperationDefinitionNode } from "graphql";
import MapPoolsPage from "~/pages/settings/application/map-pools/index.vue";

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(false) }),
}));

const map = (name: string) => ({
  id: `map-${name}`,
  name,
  label: null,
  type: "Competitive",
  poster: null,
  patch: null,
  active_pool: true,
  workshop_map_id: null,
});

const pool = (id: string, names: Array<string>) => ({
  id,
  type: "Competitive",
  maps: names.map(map),
});

const rootField = (query: any) =>
  (
    (query.definitions[0] as OperationDefinitionNode).selectionSet
      .selections[0] as FieldNode
  ).name.value;

describe("map pools page", () => {
  let push: Record<string, (data: unknown) => void> = {};
  let queries: Record<string, string> = {};
  let unmount: (() => void) | null = null;

  beforeEach(() => {
    push = {};
    queries = {};
    const client = (useNuxtApp() as any).$apollo.defaultClient;

    vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
      subscribe(observer: { next: (value: unknown) => void }) {
        queries[rootField(options.query)] = print(options.query);
        push[rootField(options.query)] = (data) => observer.next({ data });
        return { closed: false, unsubscribe() {} };
      },
    }));

    vi.spyOn(client, "watchQuery").mockImplementation((options: any) => ({
      options,
      getCurrentResult: () => ({ loading: true, data: undefined }),
      subscribe: () => ({ closed: false, unsubscribe() {} }),
      refetch: () => new Promise(() => {}),
      setVariables: () => Promise.resolve(),
      setOptions: () => Promise.resolve(),
      stopPolling() {},
      getLastError() {},
      getLastResult() {},
      resetLastResults() {},
    }));
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    vi.restoreAllMocks();
  });

  it("follows the seed pools live, so an auto-update shows without a reload", async () => {
    const wrapper = await mountSuspended(MapPoolsPage, {
      global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    expect(push.map_pools, "map_pools subscription").toBeDefined();
    expect(queries.map_pools).toMatch(/enabled: \{\s*_eq: true\s*\}/);
    expect(queries.map_pools).toMatch(/_neq: Custom/);

    push.map_pools({ map_pools: [pool("pool-1", ["de_ancient", "de_cache"])] });
    await flushPromises();
    expect(wrapper.text()).toContain("Cache");

    push.map_pools({
      map_pools: [pool("pool-2", ["de_ancient", "de_overpass"])],
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Overpass");
    expect(wrapper.text()).not.toContain("Cache");
    expect(wrapper.html()).toContain("/map-pools/pool-2");
  });
});
