import matchOptionsValidator from "./match-options-validator";

function makeComponent(overrides: Record<string, unknown> = {}) {
  return {
    $t: (key: string) => key,
    form: {
      values: {
        custom_map_pool: false,
        map_pool_id: "pool-1",
        ...overrides,
      },
    },
  };
}

function makeSettings(defaultModels = "false") {
  return [{ name: "public.default_models", value: defaultModels }];
}

describe("matchOptionsValidator", () => {
  it("parses with all defaults", () => {
    const schema = matchOptionsValidator(makeComponent(), {}, makeSettings());
    const result = schema.safeParse({ map_pool_id: "pool-1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mr).toBe("12");
      expect(result.data.knife_round).toBe(true);
      expect(result.data.overtime).toBe(true);
      expect(result.data.best_of).toBe("1");
      expect(result.data.tv_delay).toBe(115);
    }
  });

  it("enforces tv_delay max of 120", () => {
    const schema = matchOptionsValidator(makeComponent(), {}, makeSettings());
    const result = schema.safeParse({ tv_delay: 200, map_pool_id: "pool-1" });
    expect(result.success).toBe(false);
  });

  it("enforces tv_delay min of 0", () => {
    const schema = matchOptionsValidator(makeComponent(), {}, makeSettings());
    const result = schema.safeParse({ tv_delay: -1, map_pool_id: "pool-1" });
    expect(result.success).toBe(false);
  });

  it("enforces number_of_substitutes max of 5", () => {
    const schema = matchOptionsValidator(makeComponent(), {}, makeSettings());
    const result = schema.safeParse({
      number_of_substitutes: 10,
      map_pool_id: "pool-1",
    });
    expect(result.success).toBe(false);
  });

  it("respects default_models from settings", () => {
    const schema = matchOptionsValidator(
      makeComponent(),
      {},
      makeSettings("true"),
    );
    const result = schema.safeParse({ map_pool_id: "pool-1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.default_models).toBe(true);
    }
  });

  it("fails map_pool refine when custom_map_pool is true and pool is empty", () => {
    const component = makeComponent({ custom_map_pool: true, map_pool_id: null });
    const schema = matchOptionsValidator(component, {}, makeSettings());
    const result = schema.safeParse({ map_pool_id: null });
    expect(result.success).toBe(false);
  });

  it("passes map_pool refine when custom_map_pool is true and pool has maps", () => {
    const component = makeComponent({ custom_map_pool: true });
    const schema = matchOptionsValidator(component, {}, makeSettings());
    const result = schema.safeParse({
      map_pool: ["de_dust2", "de_mirage"],
      map_pool_id: null,
    });
    expect(result.success).toBe(true);
  });

  it("passes map_pool refine when using map_pool_id", () => {
    const component = makeComponent({ custom_map_pool: false, map_pool_id: "pool-1" });
    const schema = matchOptionsValidator(component, {}, makeSettings());
    const result = schema.safeParse({ map_pool_id: "pool-1" });
    expect(result.success).toBe(true);
  });
});
