import formatStatValue from "./formatStatValue";

describe("formatStatValue", () => {
  it("rounds to 2 decimal places", () => {
    expect(formatStatValue("1.456")).toBe(1.46);
  });

  it("preserves 2 decimal precision", () => {
    expect(formatStatValue("3.14")).toBe(3.14);
  });

  it("handles integer strings", () => {
    expect(formatStatValue("5")).toBe(5);
  });

  it("returns 0 for empty string", () => {
    expect(formatStatValue("")).toBe(0);
  });

  it("returns 0 for falsy input", () => {
    expect(formatStatValue(null as unknown as string)).toBe(0);
    expect(formatStatValue(undefined as unknown as string)).toBe(0);
  });
});
