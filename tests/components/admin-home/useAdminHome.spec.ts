import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useAdminHome } from "~/components/admin-home/useAdminHome";
import { needCount } from "~/components/admin-home/adminSignals";

const graphql = vi.hoisted(() => ({
  servers: [] as any[],
  db: null as null | ((data: any) => void),
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: () => ({
      subscribe: ({ next }: any) => {
        next({ data: { servers: graphql.servers } });
        return { unsubscribe: vi.fn() };
      },
    }),
    query: ({ variables }: any) =>
      // The coverage read is the only one with variables; the database read
      // answers when the test says so.
      variables
        ? Promise.resolve({ data: { utilityLineupRenderCoverage: null } })
        : new Promise((resolve) => {
            graphql.db = (data) => resolve({ data });
          }),
  }),
}));
vi.mock("~/stores/ApplicationSettings", () => ({
  useApplicationSettingsStore: () => ({
    settings: [],
    settingsLoaded: true,
    seasonsEnabled: false,
    gamePluginsEnabled: false,
    currentPluginVersion: null,
    gameServerPluginRuntime: "counterstrikesharp",
  }),
}));
vi.mock("~/stores/SystemAlertsStore", () => ({
  useSystemAlertsStore: () => ({ alerts: [] }),
}));
vi.mock("~/stores/GpuPoolStatusStore", () => ({
  useGpuPoolStatusStore: () => ({ status: null, subscribeToPool: vi.fn() }),
}));
vi.mock("~/composables/useSettingsNav", () => ({
  useSettingsNav: () => ({ items: ref([]) }),
}));

async function mountHome() {
  let home!: ReturnType<typeof useAdminHome>;
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        home = useAdminHome();
        return () => h("div");
      },
    }),
  );
  await flushPromises();
  return { home, wrapper };
}

const database = {
  getQueryStats: [],
  getActiveQueries: [],
  getCurrentLocks: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  graphql.servers = [];
  graphql.db = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAdminHome verdict", () => {
  it("waits for the database before it can call anything clear", async () => {
    const { home, wrapper } = await mountHome();
    expect(home.ready.value).toBe(false);

    // The live sources and the lazy coverage read have answered.
    await vi.advanceTimersByTimeAsync(1500);
    expect(home.ready.value).toBe(false);
    expect(home.cards.value.find((c) => c.area === "database")?.tone).toBe(
      "off",
    );

    graphql.db!({
      ...database,
      getCurrentLocks: [{ pid: 7, granted: false }],
    });
    await flushPromises();

    expect(home.ready.value).toBe(true);
    expect(home.signals.value.map((s) => s.key)).toContain("database:locks");
    wrapper.unmount();
  });

  it("never says all clear on the fallback, but shows problems already found", async () => {
    const quiet = await mountHome();
    await vi.advanceTimersByTimeAsync(9000);
    expect(quiet.home.ready.value).toBe(false);
    quiet.wrapper.unmount();

    graphql.servers = [
      { id: "s-1", label: "One", enabled: true, connected: true },
    ];
    const noisy = await mountHome();
    await vi.advanceTimersByTimeAsync(1500);
    expect(noisy.home.ready.value).toBe(false);

    await vi.advanceTimersByTimeAsync(7500);
    expect(noisy.home.ready.value).toBe(true);
    expect(needCount(noisy.home.signals.value)).toBe(1);
    noisy.wrapper.unmount();
  });
});
