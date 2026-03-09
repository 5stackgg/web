import formatBytes from "./formatBytes";

describe("formatBytes", () => {
  it("returns '0 B' for 0", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes correctly", () => {
    expect(formatBytes(500)).toBe("500.00 B");
  });

  it("formats kilobytes using base 1000", () => {
    expect(formatBytes(1000)).toBe("1.00 KB");
    expect(formatBytes(1500)).toBe("1.50 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatBytes(1000000)).toBe("1.00 MB");
  });

  it("formats gigabytes correctly", () => {
    expect(formatBytes(1000000000)).toBe("1.00 GB");
  });

  it("returns '0 B' for falsy values", () => {
    expect(formatBytes(NaN)).toBe("0 B");
  });
});
