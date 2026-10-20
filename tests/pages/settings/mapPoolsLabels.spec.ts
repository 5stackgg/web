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

// A workshop map's name is its Workshop ID, so a mode row without the label
// shows that number wherever the mode lists the map.
const WORKSHOP_ID = "3199551320";

const row = (type: string, label: string | null, enabled = true) => ({
  id: `aim_redline-${type}`,
  name: WORKSHOP_ID,
  label,
  type,
  poster: null,
  patch: null,
  active_pool: false,
  workshop_map_id: WORKSHOP_ID,
  enabled,
  deleted_at: null,
});

const rootField = (query: any) =>
  (
    (query.definitions[0] as OperationDefinitionNode).selectionSet
      .selections[0] as FieldNode
  ).name.value;

describe("map pools page, workshop map labels", () => {
  let push: Record<string, (data: unknown) => void> = {};
  let mutations: string[] = [];
  let unmount: (() => void) | null = null;

  beforeEach(() => {
    push = {};
    mutations = [];
    const client = (useNuxtApp() as any).$apollo.defaultClient;

    vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
      subscribe(observer: { next: (value: unknown) => void }) {
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

    vi.spyOn(client, "mutate").mockImplementation(async (options: any) => {
      mutations.push(print(options.mutation));
      return { data: {} };
    });
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    vi.restoreAllMocks();
  });

  async function mountWith(maps: Array<ReturnType<typeof row>>) {
    const wrapper = await mountSuspended(MapPoolsPage, {
      global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    push.maps({ maps });
    push.map_pools({ map_pools: [] });
    await flushPromises();
    return wrapper;
  }

  async function toggleMode(wrapper: any, type: string) {
    const toggle = wrapper
      .findAll('tbody button[role="switch"]')
      .find(
        (button: any) =>
          button.element.parentElement?.textContent?.trim() === type,
      );
    expect(toggle, `${type} switch`).toBeDefined();
    await toggle.trigger("click");
    await flushPromises();
    expect(mutations).toHaveLength(1);
    return mutations[0];
  }

  const updateColumns = (mutation: string) =>
    (mutation.match(/update_columns:\s*\[([^\]]*)\]/)?.[1] ?? "")
      .split(",")
      .map((column) => column.trim().replace(/"/g, ""));

  it("shows the label when the first row it gets for the map is a copy without one", async () => {
    const wrapper = await mountWith([
      row("Duel", null),
      row("Competitive", "aim_redline"),
    ]);

    const display = wrapper.get("tbody tr td").text();
    expect(display).toBe("aim_redline");
  });

  it("copies the label when the map is turned on for another mode", async () => {
    const wrapper = await mountWith([
      row("Duel", null),
      row("Competitive", "aim_redline"),
    ]);

    const mutation = await toggleMode(wrapper, "Wingman");

    expect(mutation).toContain("insert_maps");
    expect(mutation).toMatch(/type:\s*Wingman/);
    expect(mutation).toMatch(/name:\s*"3199551320"/);
    expect(mutation).toMatch(/workshop_map_id:\s*"3199551320"/);
    expect(mutation).toMatch(/label:\s*"aim_redline"/);
  });

  it("gives a mode's old copy the label when that mode is turned back on", async () => {
    const wrapper = await mountWith([
      row("Competitive", "aim_redline"),
      row("Duel", null, false),
    ]);

    const mutation = await toggleMode(wrapper, "Duel");

    expect(updateColumns(mutation).sort()).toEqual(["enabled", "label"]);
  });

  it("never blanks a copy's label from a map that has none", async () => {
    const wrapper = await mountWith([row("Competitive", null)]);

    const mutation = await toggleMode(wrapper, "Wingman");

    expect(updateColumns(mutation)).toEqual(["enabled"]);
  });
});
