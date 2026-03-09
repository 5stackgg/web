const authMock = {
  isRoleAbove: vi.fn().mockReturnValue(false),
};

vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => authMock,
}));
(globalThis as any).useAuthStore = () => authMock;

vi.mock("~/generated/zeus", () => ({
  $: (name: string, type: string) => `$${name}:${type}`,
  e_map_pool_types_enum: { Custom: "Custom" },
  e_player_roles_enum: { tournament_organizer: "tournament_organizer" },
}));

import { setupOptions, setupOptionsVariables, setupOptionsSetMutation } from "./setupOptions";

function makeFullValues(overrides: Record<string, any> = {}) {
  return {
    mr: "12",
    type: "Competitive",
    best_of: 1,
    knife_round: true,
    default_models: false,
    overtime: true,
    map_veto: true,
    coaches: false,
    region_veto: false,
    regions: ["eu"],
    number_of_substitutes: 0,
    timeout_setting: "Admin",
    ready_setting: "None",
    tech_timeout_setting: "Admin",
    tv_delay: 115,
    check_in_setting: "None",
    auto_cancellation: false,
    auto_cancel_duration: null,
    live_match_timeout: null,
    match_mode: "Normal",
    map_pool_id: "pool-1",
    ...overrides,
  };
}

describe("setupOptions", () => {
  it("calls form.setValues with all option fields and overrides", () => {
    const setValues = vi.fn();
    const form = { setValues } as any;
    const options = {
      overtime: true,
      knife_round: true,
      mr: 12,
      best_of: 1,
      coaches: false,
      number_of_substitutes: 0,
      map_veto: true,
      timeout_setting: "Admin",
      tech_timeout_setting: "Admin",
      type: "Competitive",
      default_models: false,
      region_veto: false,
      ready_setting: "None",
      map_pool: { id: "pool-1" },
      regions: ["eu"],
      tv_delay: 115,
      check_in_setting: "None",
      auto_cancellation: false,
      auto_cancel_duration: null,
      live_match_timeout: null,
      match_mode: "Normal",
    };

    setupOptions(form, options, { mr: "16" });
    expect(setValues).toHaveBeenCalledTimes(1);
    const arg = setValues.mock.calls[0][0];
    expect(arg.mr).toBe("16"); // override applied
    expect(arg.overtime).toBe(true);
    expect(arg.map_pool_id).toBe("pool-1");
  });
});

describe("setupOptionsVariables", () => {
  beforeEach(() => {
    authMock.isRoleAbove.mockReturnValue(false);
  });

  it("throws for missing mr", () => {
    expect(() => setupOptionsVariables(makeFullValues({ mr: undefined }))).toThrow("mr is required");
  });

  it("throws for missing type", () => {
    expect(() => setupOptionsVariables(makeFullValues({ type: undefined }))).toThrow("type is required");
  });

  it("throws for missing best_of", () => {
    expect(() => setupOptionsVariables(makeFullValues({ best_of: undefined }))).toThrow("best_of is required");
  });

  it("throws for missing knife_round", () => {
    expect(() => setupOptionsVariables(makeFullValues({ knife_round: undefined }))).toThrow("knife_round is required");
  });

  it("throws for missing map_pool when no mapPoolId", () => {
    expect(() => setupOptionsVariables(makeFullValues({ map_pool_id: undefined }))).toThrow("map_pool is required");
  });

  it("uses additional.mapPoolId over values.map_pool_id", () => {
    const result = setupOptionsVariables(makeFullValues(), { mapPoolId: "override-pool" });
    expect(result.map_pool_id).toBe("override-pool");
  });

  it("includes admin fields when user is tournament_organizer+", () => {
    authMock.isRoleAbove.mockReturnValue(true);
    const result = setupOptionsVariables(makeFullValues({
      check_in_setting: "Enabled",
      auto_cancellation: true,
      auto_cancel_duration: 60,
      live_match_timeout: 120,
      match_mode: "Normal",
    }));
    expect(result).toHaveProperty("check_in_setting", "Enabled");
    expect(result).toHaveProperty("auto_cancellation", true);
    expect(result).toHaveProperty("auto_cancel_duration", 60);
    expect(result).toHaveProperty("live_match_timeout", 120);
    expect(result).toHaveProperty("match_mode", "Normal");
  });

  it("omits admin fields when user role is below tournament_organizer", () => {
    authMock.isRoleAbove.mockReturnValue(false);
    const result = setupOptionsVariables(makeFullValues());
    expect(result).not.toHaveProperty("check_in_setting");
    expect(result).not.toHaveProperty("auto_cancellation");
    expect(result).not.toHaveProperty("match_mode");
  });

  it("includes map_pool_id when mapPoolId provided", () => {
    const result = setupOptionsVariables(makeFullValues(), { mapPoolId: "pool-2" });
    expect(result.map_pool_id).toBe("pool-2");
    expect(result.map_pool).toBeNull();
  });

  it("creates inline map_pool data when no mapPoolId", () => {
    const result = setupOptionsVariables(makeFullValues({
      map_pool_id: undefined,
      map_pool: ["map-1", "map-2"],
    }));
    expect(result).not.toHaveProperty("map_pool_id");
    expect(result.map_pool).toEqual({
      data: {
        type: "Custom",
        maps: {
          data: [{ id: "map-1" }, { id: "map-2" }],
        },
      },
    });
  });

  it("includes matchOptionsId when provided", () => {
    const result = setupOptionsVariables(makeFullValues(), { matchOptionsId: "opts-1" });
    expect(result.id).toBe("opts-1");
  });
});

describe("setupOptionsSetMutation", () => {
  beforeEach(() => {
    authMock.isRoleAbove.mockReturnValue(false);
  });

  it("includes map_pool_id when hasMapPoolId=true", () => {
    const result = setupOptionsSetMutation(true);
    expect(result).toHaveProperty("map_pool_id");
    expect(result).not.toHaveProperty("map_pool");
  });

  it("includes map_pool when hasMapPoolId=false", () => {
    const result = setupOptionsSetMutation(false);
    expect(result).toHaveProperty("map_pool");
    expect(result).not.toHaveProperty("map_pool_id");
  });

  it("includes admin fields when role is tournament_organizer+", () => {
    authMock.isRoleAbove.mockReturnValue(true);
    const result = setupOptionsSetMutation(true);
    expect(result).toHaveProperty("check_in_setting");
    expect(result).toHaveProperty("auto_cancellation");
    expect(result).toHaveProperty("match_mode");
  });

  it("omits admin fields when role is below tournament_organizer", () => {
    authMock.isRoleAbove.mockReturnValue(false);
    const result = setupOptionsSetMutation(true);
    expect(result).not.toHaveProperty("check_in_setting");
    expect(result).not.toHaveProperty("auto_cancellation");
    expect(result).not.toHaveProperty("match_mode");
  });
});
