import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import type { FieldNode, OperationDefinitionNode } from "graphql";
import MapPoolPage from "~/pages/settings/application/map-pools/[id].vue";
import MapDisplay from "~/components/MapDisplay.vue";
import MapPoolForm from "~/components/map-pools/MapPoolForm.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: vi.fn(),
}));

const map = (name: string) => ({
  id: `map-${name}`,
  name,
  label: null,
  type: "Competitive",
  poster: null,
  patch: null,
  active_pool: false,
  workshop_map_id: null,
});

const dust2 = map("de_dust2");
const nuke = map("de_nuke");
const poseidon = map("de_poseidon");

const pool = (seed: boolean) => ({
  id: "pool-1",
  type: "Competitive",
  seed,
  enabled: true,
  maps: [dust2, poseidon],
});

const answers: Record<string, unknown> = {
  maps: [dust2, nuke],
  map_pools_by_pk: pool(false),
};

describe("map pool editor", () => {
  let unmount: (() => void) | null = null;
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const client = (useNuxtApp() as any).$apollo.defaultClient;

    vi.spyOn(client, "watchQuery").mockImplementation((options: any) => {
      const operation = options.query.definitions[0] as OperationDefinitionNode;
      const field = (operation.selectionSet.selections[0] as FieldNode).name
        .value;
      const result = () => ({
        loading: false,
        networkStatus: 7,
        data: { [field]: answers[field] },
      });

      return {
        options,
        getCurrentResult: () => ({ loading: true, data: undefined }),
        subscribe(observer: { next: (value: unknown) => void }) {
          Promise.resolve().then(() => observer.next(result()));
          return { closed: false, unsubscribe() {} };
        },
        refetch: () => Promise.resolve(result()),
        setVariables: () => Promise.resolve(),
        setOptions: () => Promise.resolve(),
        stopPolling() {},
        getLastError() {},
        getLastResult() {},
        resetLastResults() {},
      } as any;
    });

    mutate = vi.fn(async () => ({ data: {} }));
    vi.spyOn(client, "mutate").mockImplementation(mutate);
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    vi.restoreAllMocks();
    answers.maps = [dust2, nuke];
    answers.map_pools_by_pk = pool(false);
    useApplicationSettingsStore().settings = [];
  });

  async function mountPage() {
    const wrapper = await mountSuspended(MapPoolPage, {
      global: {
        mixins: (useNuxtApp().vueApp as any)._context.mixins,
        stubs: { SettingsSaveBar: true },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  type Wrapper = Awaited<ReturnType<typeof mountPage>>;

  const tile = (wrapper: Wrapper, name: string) =>
    wrapper
      .findAllComponents(MapDisplay)
      .find((display) => display.props("map").name === name)
      ?.element.closest("div.rounded-lg.overflow-hidden");

  it("shows a map that is in the pool but no longer enabled for its mode, selected", async () => {
    const wrapper = await mountPage();

    const poseidonTile = tile(wrapper, "de_poseidon");
    expect(poseidonTile, "de_poseidon tile").toBeTruthy();
    expect(poseidonTile!.classList.contains("opacity-40")).toBe(false);
    expect(tile(wrapper, "de_nuke")!.classList.contains("opacity-40")).toBe(
      true,
    );
  });

  it("lets that map be removed from the pool", async () => {
    const wrapper = await mountPage();

    (tile(wrapper, "de_poseidon") as HTMLElement).click();
    await flushPromises();
    await (wrapper.findComponent(MapPoolForm).vm as any).saveMapPool();
    await flushPromises();

    const remove = mutate.mock.calls
      .map(([options]: [any]) => print(options.mutation))
      .find((body) => body.includes("delete__map_pool("));
    expect(remove).toContain("map-de_dust2");
    expect(remove).not.toContain("map-de_poseidon");
  });

  const LOCKED =
    "Automatic update map pools keeps this pool matching Active Duty. Turn it off to choose maps yourself.";

  const autoUpdate = (value: string) => {
    useApplicationSettingsStore().settings = [
      { name: "update_map_pools", value },
    ];
  };

  it("locks a seeded pool while auto-update keeps it in sync, and says why", async () => {
    answers.maps = [{ ...dust2, active_pool: true }, nuke];
    answers.map_pools_by_pk = pool(true);
    useApplicationSettingsStore().settings = [
      { name: "update_map_pools", value: "true" },
    ];
    const wrapper = await mountPage();

    (tile(wrapper, "de_nuke") as HTMLElement).click();
    await flushPromises();

    expect(wrapper.text()).toContain(LOCKED);
    expect(tile(wrapper, "de_nuke")!.classList.contains("opacity-40")).toBe(
      true,
    );
  });

  it("leaves a seeded pool editable with auto-update off", async () => {
    answers.map_pools_by_pk = pool(true);
    useApplicationSettingsStore().settings = [
      { name: "update_map_pools", value: "false" },
    ];
    const wrapper = await mountPage();

    (tile(wrapper, "de_nuke") as HTMLElement).click();
    await flushPromises();

    expect(wrapper.text()).not.toContain(LOCKED);
    expect(tile(wrapper, "de_nuke")!.classList.contains("opacity-40")).toBe(
      false,
    );
  });

  it("leaves a seeded pool editable when its mode has no active-duty maps to sync", async () => {
    answers.map_pools_by_pk = pool(true);
    autoUpdate("true");
    const wrapper = await mountPage();

    (tile(wrapper, "de_nuke") as HTMLElement).click();
    await flushPromises();

    expect(wrapper.text()).not.toContain(LOCKED);
    expect(tile(wrapper, "de_nuke")!.classList.contains("opacity-40")).toBe(
      false,
    );
  });

  it("won't save an edit made before the lock appeared", async () => {
    answers.maps = [{ ...dust2, active_pool: true }, nuke];
    answers.map_pools_by_pk = pool(true);
    autoUpdate("false");
    const wrapper = await mountPage();

    (tile(wrapper, "de_nuke") as HTMLElement).click();
    await flushPromises();
    expect(wrapper.findComponent(SettingsSaveBar).props("dirty")).toBe(true);

    autoUpdate("true");
    await flushPromises();
    await (wrapper.findComponent(MapPoolForm).vm as any).saveMapPool();
    await flushPromises();

    expect(wrapper.findComponent(SettingsSaveBar).props("dirty")).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });
});
