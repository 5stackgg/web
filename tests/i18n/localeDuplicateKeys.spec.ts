// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// JSON.parse keeps the last of two identical keys and says nothing, so the
// first one's text silently never shows. Only the raw file can tell.
function duplicateKeys(text: string): string[] {
  const duplicates: string[] = [];
  let index = 0;

  const skipWhitespace = () => {
    while (/\s/.test(text[index] ?? "")) {
      index++;
    }
  };

  const readString = () => {
    let value = "";
    index++;
    while (text[index] !== '"') {
      if (text[index] === "\\") {
        value += text[index] + text[index + 1];
        index += 2;
      } else {
        value += text[index];
        index++;
      }
    }
    index++;
    return value;
  };

  const readValue = (path: string) => {
    skipWhitespace();
    if (text[index] === "{") {
      index++;
      const seen = new Set<string>();
      skipWhitespace();
      while (text[index] !== "}") {
        skipWhitespace();
        const key = readString();
        const keyPath = path ? `${path}.${key}` : key;
        if (seen.has(key)) {
          duplicates.push(keyPath);
        }
        seen.add(key);
        skipWhitespace();
        index++;
        readValue(keyPath);
        skipWhitespace();
        if (text[index] === ",") {
          index++;
          skipWhitespace();
        }
      }
      index++;
      return;
    }
    if (text[index] === "[") {
      index++;
      skipWhitespace();
      while (text[index] !== "]") {
        readValue(path);
        skipWhitespace();
        if (text[index] === ",") {
          index++;
          skipWhitespace();
        }
      }
      index++;
      return;
    }
    if (text[index] === '"') {
      readString();
      return;
    }
    while (index < text.length && !/[,}\]\s]/.test(text[index])) {
      index++;
    }
  };

  readValue("");
  return duplicates;
}

describe("locale files", () => {
  it("finds a key repeated inside one object", () => {
    expect(duplicateKeys('{"a":{"b":"1","c":"2","b":"3"},"b":"4"}')).toEqual([
      "a.b",
    ]);
  });

  const files = readdirSync("i18n/locales").filter((file) =>
    file.endsWith(".json"),
  );

  it.each(files)("%s never repeats a key inside one object", (file) => {
    expect(
      duplicateKeys(readFileSync(`i18n/locales/${file}`, "utf8")),
    ).toEqual([]);
  });
});
