import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import { useMyMatchRoles, withMatchRoles } from "~/composables/useMyMatchRoles";

const fake = vi.hoisted(() => ({
  fields: ["active_matches", "my_active_matches"],
  subscriptions: [] as Array<{
    query: string;
    next: (result: any) => void;
    error: (err: any) => void;
    closed: boolean;
  }>,
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      query: async () => ({
        data: { __type: { fields: fake.fields.map((name) => ({ name })) } },
      }),
      subscribe: ({ query }: any) => ({
        subscribe: (observer: any) => {
          const sub = { query: print(query), ...observer, closed: false };
          fake.subscriptions.push(sub);
          return {
            unsubscribe() {
              sub.closed = true;
            },
          };
        },
      }),
    },
  }),
}));

// Asked fresh each time: the real one remembers its first answer for the page.
vi.mock("~/utilities/schemaHasType", () => ({
  schemaHasField: async (client: any, _type: string, field: string) => {
    const { data } = await client.query({});
    return data.__type.fields.some(({ name }: any) => name === field);
  },
}));

async function mountRoles() {
  let state!: ReturnType<typeof useMyMatchRoles>;
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useMyMatchRoles();
        return () => h("div");
      },
    }),
  );
  await flushPromises();
  return { wrapper, state };
}

const push = (rows: any[]) =>
  fake.subscriptions.at(-1)!.next({ data: { my_active_matches: rows } });

describe("useMyMatchRoles", () => {
  beforeEach(() => {
    fake.fields = ["active_matches", "my_active_matches"];
    fake.subscriptions.length = 0;
    useAuthStore().me = { steam_id: "1", role: "user" } as any;
  });

  afterEach(() => {
    useAuthStore().me = undefined;
  });

  it("has nothing to ask for a signed-out viewer", async () => {
    useAuthStore().me = undefined;
    const { state } = await mountRoles();

    expect(state.ready.value).toBe(false);
    expect(fake.subscriptions).toHaveLength(0);
  });

  it("falls back when the api does not serve my_active_matches", async () => {
    fake.fields = ["active_matches"];
    const { state } = await mountRoles();

    expect(state.ready.value).toBe(false);
    expect(fake.subscriptions).toHaveLength(0);
  });

  it("is not ready until the viewer's own matches are in", async () => {
    const { state } = await mountRoles();

    expect(fake.subscriptions).toHaveLength(1);
    expect(fake.subscriptions[0].query).toMatch(/my_active_matches/);
    expect(state.ready.value).toBe(null);

    push([
      { id: "playing", is_in_lineup: true, is_coach: false },
      { id: "coaching", is_in_lineup: false, is_coach: true },
    ]);

    expect(state.ready.value).toBe(true);
    expect(Object.fromEntries(state.roles.value)).toEqual({
      playing: { is_in_lineup: true, is_coach: false },
      coaching: { is_in_lineup: false, is_coach: true },
    });
  });

  it("keeps a match's flags once it leaves the active list", async () => {
    const { state } = await mountRoles();
    push([{ id: "playing", is_in_lineup: true, is_coach: false }]);
    push([]);

    expect(state.roles.value.get("playing")).toEqual({
      is_in_lineup: true,
      is_coach: false,
    });
  });

  it("falls back when the subscription fails", async () => {
    const { state } = await mountRoles();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake.subscriptions[0].error(new Error("nope"));

    expect(state.ready.value).toBe(false);
  });

  it("stops following on unmount", async () => {
    const { wrapper } = await mountRoles();
    wrapper.unmount();

    expect(fake.subscriptions[0].closed).toBe(true);
  });
});

describe("withMatchRoles", () => {
  it("marks the viewer's own matches on rows read as a guest", () => {
    const roles = new Map([
      ["playing", { is_in_lineup: true, is_coach: false }],
      ["coaching", { is_in_lineup: false, is_coach: true }],
    ]);
    const rows = ["playing", "coaching", "other"].map((id) => ({
      id,
      is_in_lineup: false,
      is_coach: false,
    }));

    expect(withMatchRoles(rows, roles)).toEqual([
      { id: "playing", is_in_lineup: true, is_coach: false },
      { id: "coaching", is_in_lineup: false, is_coach: true },
      { id: "other", is_in_lineup: false, is_coach: false },
    ]);
  });

  // An api that does not yet answer the public socket as a guest reads the
  // rows as the viewer, and an older my_active_matches leaves coaches out.
  it("keeps a row's own flags", () => {
    const rows = [{ id: "coaching", is_in_lineup: false, is_coach: true }];

    expect(withMatchRoles(rows, new Map())).toEqual(rows);
  });
});
