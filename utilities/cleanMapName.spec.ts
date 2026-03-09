import cleanMapName from "./cleanMapName";

describe("cleanMapName", () => {
  it("strips de_ prefix and title-cases", () => {
    expect(cleanMapName("de_dust2")).toBe("Dust2");
  });

  it("replaces underscores with spaces and title-cases each word", () => {
    expect(cleanMapName("ancient_ruins")).toBe("Ancient Ruins");
  });

  it("strips de_ prefix and title-cases single word", () => {
    expect(cleanMapName("de_anubis")).toBe("Anubis");
  });

  it("handles empty string", () => {
    expect(cleanMapName("")).toBe("");
  });
});
