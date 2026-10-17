import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { print } from "graphql";
import { useLastChanged } from "~/composables/useLastChanged";

const api = vi.hoisted(() => ({
  fields: new Set<string>(),
  query: null as any,
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query: api.query } }),
}));

vi.mock("~/utilities/schemaHasType", () => ({
  schemaHasField: async (_client: any, _type: string, field: string) =>
    api.fields.has(field),
}));

const ADMIN = { name: "Granting Admin", steam_id: "76561198000000042" };

function stamp(type: string, at: string | null, by: any = ADMIN) {
  return {
    data: { [`${type}_by_pk`]: { last_changed_at: at, last_changed_by: by } },
  };
}

async function settle() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

let scope: ReturnType<typeof effectScope> | null = null;

function run<T>(fn: () => T): T {
  scope = effectScope();
  return scope.run(fn)!;
}

beforeEach(() => {
  api.fields = new Set(["last_changed_at", "last_changed_by"]);
  api.query = vi.fn();
});

afterEach(() => {
  scope?.stop();
  scope = null;
  vi.useRealTimers();
});

describe("useLastChanged", () => {
  it("asks nothing and answers nulls while the api lacks the column", async () => {
    api.fields = new Set();

    const { at, by } = run(() => useLastChanged("servers", ref("srv-1")));
    await settle();

    expect(api.query).not.toHaveBeenCalled();
    expect(at.value).toBeNull();
    expect(by.value).toBeNull();
  });

  it("reads the row's stamp once the api serves it", async () => {
    api.query.mockResolvedValue(stamp("servers", "2026-10-17T09:00:00Z"));

    const { at, by } = run(() => useLastChanged("servers", ref("srv-1")));
    await settle();

    expect(api.query).toHaveBeenCalledTimes(1);
    const [{ query, variables, fetchPolicy }] = api.query.mock.calls[0];
    expect(print(query)).toContain("servers_by_pk(id: $key)");
    expect(print(query)).toContain("last_changed_by");
    expect(variables).toEqual({ key: "srv-1" });
    expect(fetchPolicy).toBe("no-cache");
    expect(at.value).toBe("2026-10-17T09:00:00Z");
    expect(by.value).toEqual(ADMIN);
  });

  it("keys regions by value, and asks no name a role can't read", async () => {
    api.fields = new Set(["last_changed_at"]);
    api.query.mockResolvedValue({
      data: {
        server_regions_by_pk: { last_changed_at: "2026-10-17T09:00:00Z" },
      },
    });

    const { at, by } = run(() => useLastChanged("server_regions", ref("eu")));
    await settle();

    const [{ query }] = api.query.mock.calls[0];
    expect(print(query)).toContain("server_regions_by_pk(value: $key)");
    expect(print(query)).not.toContain("last_changed_by");
    expect(at.value).toBe("2026-10-17T09:00:00Z");
    expect(by.value).toBeNull();
  });

  it("answers nulls for a row nobody has edited since the stamp shipped", async () => {
    api.query.mockResolvedValue(stamp("seasons", null, null));

    const { at, by } = run(() => useLastChanged("seasons", ref("s-1")));
    await settle();

    expect(at.value).toBeNull();
    expect(by.value).toBeNull();
  });

  it("reads again once an edit to the live row settles", async () => {
    vi.useFakeTimers();
    api.query
      .mockResolvedValueOnce(stamp("awards", "2026-10-17T09:00:00Z"))
      .mockResolvedValueOnce(
        stamp("awards", "2026-10-17T12:00:00Z", {
          name: "Other Admin",
          steam_id: "76561198000000043",
        }),
      );
    const key = ref<unknown>("v1");

    const { at, by } = run(() => useLastChanged("awards", ref("a-1"), key));
    await settle();
    expect(at.value).toBe("2026-10-17T09:00:00Z");

    key.value = "v2";
    await nextTick();
    expect(api.query).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(600);
    await settle();

    expect(api.query).toHaveBeenCalledTimes(2);
    expect(at.value).toBe("2026-10-17T12:00:00Z");
    expect(by.value?.name).toBe("Other Admin");
  });

  it("doesn't read again when the live row first arrives", async () => {
    vi.useFakeTimers();
    api.query.mockResolvedValue(stamp("awards", "2026-10-17T09:00:00Z"));
    const key = ref<unknown>(null);

    run(() => useLastChanged("awards", ref("a-1"), key));
    await settle();

    key.value = "v1";
    await nextTick();
    await vi.advanceTimersByTimeAsync(600);

    expect(api.query).toHaveBeenCalledTimes(1);
  });

  it("clears and reads at once for another row, dropping the slower answer", async () => {
    let answerFirst: (value: unknown) => void = () => {};
    api.query
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce(
        stamp("game_server_nodes", "2026-10-17T12:00:00Z"),
      );
    const id = ref<string | null>("node-a");

    const { at } = run(() => useLastChanged("game_server_nodes", id));
    await settle();

    id.value = "node-b";
    await nextTick();
    await settle();
    answerFirst(stamp("game_server_nodes", "2026-10-17T09:00:00Z"));
    await settle();

    expect(api.query).toHaveBeenCalledTimes(2);
    expect(api.query.mock.calls[1][0].variables).toEqual({ key: "node-b" });
    expect(at.value).toBe("2026-10-17T12:00:00Z");

    id.value = null;
    await nextTick();
    expect(at.value).toBeNull();
  });
});
