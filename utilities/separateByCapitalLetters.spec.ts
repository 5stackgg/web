import { separateByCapitalLetters } from "./separateByCapitalLetters";

describe("separateByCapitalLetters", () => {
  it("inserts space before capitals", () => {
    expect(separateByCapitalLetters("HelloWorld")).toBe("Hello World");
  });

  it("handles multiple camelCase transitions", () => {
    expect(separateByCapitalLetters("myVariableName")).toBe("my Variable Name");
  });

  it("preserves already-spaced strings", () => {
    expect(separateByCapitalLetters("Hello World")).toBe("Hello World");
  });

  it("handles all-lowercase", () => {
    expect(separateByCapitalLetters("hello")).toBe("hello");
  });

  it("handles all-uppercase (no lowercase-uppercase boundary)", () => {
    expect(separateByCapitalLetters("ABC")).toBe("ABC");
  });
});
