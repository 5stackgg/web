import guid from "./uuid";

describe("guid", () => {
  it("returns string matching UUID-like format (8-4-4-4-12 hex)", () => {
    const result = guid();
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("generates unique values on successive calls", () => {
    const a = guid();
    const b = guid();
    expect(a).not.toBe(b);
  });
});
