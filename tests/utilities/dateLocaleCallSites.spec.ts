// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every date, time and duration the app shows goes through dateLocale(), or
// one screen reads 21:30 while the next reads 9:30 PM. Numbers are not
// checked: their toLocaleString calls carry no date options, and only a
// NumberFormat that formats units is a duration.
const ROOTS = [
  "components",
  "composables",
  "layouts",
  "pages",
  "plugins",
  "stores",
  "utilities",
  "utils",
];
const SKIP = new Set(["utilities/dateLocale.ts"]);
const DATE_OPTIONS =
  /\b(hour|minute|second|weekday|month|day|year|era|dateStyle|timeStyle|timeZoneName)\s*:/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(vue|ts)$/.test(entry.name) && !SKIP.has(path) ? [path] : [];
  });
}

function callArguments(source: string, open: number) {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if ("([{".includes(char)) {
      depth++;
    } else if (")]}".includes(char)) {
      depth--;
      if (depth === 0) {
        return source.slice(open + 1, i);
      }
    }
  }
  return source.slice(open + 1);
}

function firstArgument(args: string) {
  let depth = 0;
  for (let i = 0; i < args.length; i++) {
    const char = args[i];
    if ("([{".includes(char)) {
      depth++;
    } else if (")]}".includes(char)) {
      depth--;
    } else if (char === "," && depth === 0) {
      return args.slice(0, i).trim();
    }
  }
  return args.trim();
}

function bypasses(path: string) {
  const source = readFileSync(path, "utf8");
  const found: string[] = [];
  const calls =
    /(new\s+Intl\.(?:DateTimeFormat|RelativeTimeFormat|NumberFormat)|Intl\.(?:DateTimeFormat|RelativeTimeFormat|NumberFormat)|\.toLocaleDateString|\.toLocaleTimeString|\.toLocaleString)\s*\(/g;

  for (const match of source.matchAll(calls)) {
    const open = match.index! + match[0].length - 1;
    const args = callArguments(source, open);
    const after = source.slice(open + args.length + 2, open + args.length + 20);
    const before = source.slice(Math.max(0, match.index! - 80), match.index!);
    const kind = match[1];

    if (/DateTimeFormat$/.test(kind) && !args.trim()) {
      if (after.startsWith(".resolvedOptions()")) {
        continue;
      }
    }

    const isDate = /NumberFormat$/.test(kind)
      ? /style\s*:\s*["']unit["']/.test(args)
      : kind !== ".toLocaleString" ||
        DATE_OPTIONS.test(args) ||
        /new Date\([^;]*\)\s*$/.test(before);

    if (isDate && firstArgument(args) !== "dateLocale()") {
      const line = source.slice(0, match.index).split("\n").length;
      found.push(`${path}:${line} ${kind}(${firstArgument(args)}`);
    }
  }
  return found;
}

// Chart.js titles a tooltip with '' + the label, so Date labels show
// Date.prototype.toString() without any call above to catch.
function untitledDateLabels(path: string) {
  const source = readFileSync(path, "utf8");
  if (!source.includes('from "vue-chartjs"')) {
    return [];
  }
  const found: string[] = [];
  const labels = /\blabels\s*\(\)[^{]*\{|\blabels\s*=\s*computed\(/g;

  for (const match of source.matchAll(labels)) {
    const open = match.index! + match[0].length - 1;
    if (
      /new Date\(/.test(callArguments(source, open)) &&
      !/\btitle\s*:\s*\(/.test(source)
    ) {
      const line = source.slice(0, match.index).split("\n").length;
      found.push(`${path}:${line} Date labels with no tooltip title`);
    }
  }
  return found;
}

describe("date and time formatting", () => {
  it("goes through dateLocale() everywhere", () => {
    const offenders = ROOTS.flatMap((root) =>
      sourceFiles(root).flatMap(bypasses),
    );

    expect(offenders).toEqual([]);
  });

  it("titles a chart tooltip itself when the labels are dates", () => {
    const offenders = ROOTS.flatMap((root) =>
      sourceFiles(root).flatMap(untitledDateLabels),
    );

    expect(offenders).toEqual([]);
  });
});
