import { kdrColor, kdrStrokeColor } from "./kdrColor";

describe("kdrColor", () => {
  it("returns red for KDR below 0.9", () => {
    expect(kdrColor(0.5)).toBe("text-red-500");
    expect(kdrColor(0.89)).toBe("text-red-500");
  });

  it("returns orange for KDR between 0.9 and 1.0", () => {
    expect(kdrColor(0.9)).toBe("text-orange-500");
    expect(kdrColor(0.99)).toBe("text-orange-500");
  });

  it("returns light green for KDR between 1.0 and 1.1", () => {
    expect(kdrColor(1.0)).toBe("text-green-400");
    expect(kdrColor(1.09)).toBe("text-green-400");
  });

  it("returns dark green for KDR >= 1.1", () => {
    expect(kdrColor(1.1)).toBe("text-green-600");
    expect(kdrColor(2.0)).toBe("text-green-600");
  });
});

describe("kdrStrokeColor", () => {
  it("returns HSL red for KDR below 0.9", () => {
    expect(kdrStrokeColor(0.5)).toBe("hsl(0, 84%, 60%)");
  });

  it("returns HSL orange for KDR between 0.9 and 1.0", () => {
    expect(kdrStrokeColor(0.95)).toBe("hsl(25, 95%, 53%)");
  });

  it("returns HSL light green for KDR between 1.0 and 1.1", () => {
    expect(kdrStrokeColor(1.0)).toBe("hsl(142, 69%, 58%)");
  });

  it("returns HSL dark green for KDR >= 1.1", () => {
    expect(kdrStrokeColor(1.5)).toBe("hsl(142, 71%, 45%)");
  });

  it("returns different colors for different ranges", () => {
    expect(kdrStrokeColor(0.5)).not.toBe(kdrStrokeColor(1.5));
  });
});
