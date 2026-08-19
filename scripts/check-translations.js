import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to flatten translation object into dot notation
function flattenTranslations(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, key) => {
    const prefixedKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      return { ...acc, ...flattenTranslations(obj[key], prefixedKey) };
    }
    return { ...acc, [prefixedKey]: obj[key] };
  }, {});
}

// Function to extract translation keys from a file
// Returns:
//   - directKeys: keys passed straight to $t("...") / t("...") / i18n.t("...").
//     These MUST exist in the translation files; flag them as missing otherwise.
//   - heuristicKeys: string literals that *look* like translation keys.
//     Only used to mark keys as "used" — a false positive just means a
//     shape-matching literal did not correspond to a real translation key.
//   - Dynamic template keys like $t(`foo.bar.${baz}`) are tracked by prefix.

// Pull every string literal out of a source file, skipping comments.
//
// This used to be a single alternating regex -- /'([^']+)'|"([^"]+)"|`([^`]+)`/ --
// which desynchronised on the first apostrophe in prose. A `// the player's name`
// comment opened a bogus single-quoted "string" that swallowed everything up to
// the next apostrophe, so every literal in between went unseen. Real keys then
// showed up in the "unused" report and looked safe to delete. Walking the file
// once, tracking comment and string state, is the only way to get this right.
function extractStringLiterals(content) {
  const literals = [];
  const length = content.length;
  let i = 0;

  // Whether a `/` here starts a regex literal rather than division. Good enough:
  // a regex can only follow an operator or an opening bracket, never a value.
  let regexAllowed = true;

  while (i < length) {
    const char = content[i];
    const next = content[i + 1];

    if (char === "<" && content.startsWith("<!--", i)) {
      const end = content.indexOf("-->", i + 4);
      i = end === -1 ? length : end + 3;
      continue;
    }

    // `content[i - 1] !== ":"` keeps a bare https:// URL in template text from
    // being read as a comment and swallowing the rest of the line.
    if (char === "/" && next === "/" && content[i - 1] !== ":") {
      const end = content.indexOf("\n", i);
      i = end === -1 ? length : end;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = content.indexOf("*/", i + 2);
      i = end === -1 ? length : end + 2;
      continue;
    }

    if (char === "/" && regexAllowed) {
      let j = i + 1;
      let closed = false;
      let inClass = false;
      while (j < length) {
        const c = content[j];
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === "\n") break;
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) {
          closed = true;
          j += 1;
          break;
        }
        j += 1;
      }
      if (closed) {
        i = j;
        regexAllowed = false;
        continue;
      }
    }

    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      let j = i + 1;
      let value = "";
      while (j < length) {
        const c = content[j];
        if (c === "\\") {
          value += content[j + 1] ?? "";
          j += 2;
          continue;
        }
        if (c === quote) break;
        // An unterminated single/double quote is almost always an apostrophe in
        // prose that the comment skip did not catch -- bail at the newline
        // instead of swallowing the rest of the file.
        if (c === "\n" && quote !== "`") break;
        value += c;
        j += 1;
      }
      if (j < length && content[j] === quote) {
        literals.push(value);
        i = j + 1;
      } else {
        i += 1;
      }
      regexAllowed = false;
      continue;
    }

    if (!/\s/.test(char)) {
      regexAllowed = /[=(,:[!&|?{};+\-*%<>~^]/.test(char);
    }
    i += 1;
  }

  return literals;
}

function extractTranslationKeys(content, keyPrefixPattern, dynamicPrefixes) {
  const directKeys = new Set();
  const heuristicKeys = new Set();

  // Regex to match $t("...") / t("...") / i18n.t("...") with various endings and spacing
  const directPattern = /\b(?:\$t|t)\s*\(\s*(['"`])([^'"`]+)\1(?:\s*[,)])/g;
  const directMatches = Array.from(content.matchAll(directPattern));

  directMatches.forEach((match) => {
    const key = match[2];
    if (key.includes("${")) {
      const prefix = key.split("${")[0];
      if (prefix && dynamicPrefixes) {
        dynamicPrefixes.add(prefix);
      }
      return;
    }
    // A bare `t("build_current")` is a local prefix helper, not a real lookup --
    // e.g. `const t = (key) => this.$t(`pages.system_telemetry.foo.${key}`)`.
    // Every real key is namespaced, so a dotless one can never resolve and
    // reporting it as missing is pure noise. The composed key is still covered:
    // the helper's literal prefix is picked up as a dynamic prefix.
    if (!key.includes(".")) {
      return;
    }
    directKeys.add(key);
  });

  // Catch <i18n-t keypath="foo.bar"> / <I18nT keypath="foo.bar"> components.
  // These render a translation by key just like $t(...), so the key must exist.
  const keypathPattern = /\bkeypath\s*=\s*(['"`])([^'"`]+)\1/g;
  Array.from(content.matchAll(keypathPattern)).forEach((match) => {
    const key = match[2];
    if (key.includes("${")) {
      return;
    }
    directKeys.add(key);
  });

  // Also catch namespaced calls like i18n.t("foo.bar.baz")
  const namespacedTPattern = /\b\w+\.t\s*\(\s*(['"`])([^'"`]+)\1(?:\s*[,)])/g;
  const namespacedMatches = Array.from(content.matchAll(namespacedTPattern));

  namespacedMatches.forEach((match) => {
    const key = match[2];
    if (key.includes("${")) {
      const prefix = key.split("${")[0];
      if (prefix && dynamicPrefixes) {
        dynamicPrefixes.add(prefix);
      }
      return;
    }
    directKeys.add(key);
  });

  // Additionally, capture string literals that look like translation keys
  // based on known prefixes from the translation files (e.g. pages.*, layouts.*, common.*, etc.)
  if (keyPrefixPattern) {
    const literalMatches = extractStringLiterals(content);
    const translationKeyShape = /^[a-z0-9_]+(\.[a-z0-9_]+){2,}$/;

    literalMatches.forEach((candidate) => {
      if (
        translationKeyShape.test(candidate) &&
        keyPrefixPattern.test(candidate)
      ) {
        heuristicKeys.add(candidate);
      }
    });
  }

  return {
    directKeys: [...directKeys],
    heuristicKeys: [...heuristicKeys],
  };
}

// Function to find all translation keys in the project
async function findAllTranslationKeys(keyPrefixPattern) {
  const directKeys = new Set();
  const heuristicKeys = new Set();
  const keyLocations = new Map();
  const dynamicPrefixes = new Set();

  // Find all Vue, JS, and TS files
  const files = await glob("**/*.{vue,js,ts}", {
    ignore: ["node_modules/**", "dist/**", "scripts/**"],
  });

  // Process each file
  const fileResults = files.map((file) => {
    const content = fs.readFileSync(file, "utf8");
    const fileKeys = extractTranslationKeys(
      content,
      keyPrefixPattern,
      dynamicPrefixes,
    );
    return { file, fileKeys };
  });

  // Collect all keys and their locations
  fileResults.forEach(({ file, fileKeys }) => {
    const { directKeys: dk, heuristicKeys: hk } = fileKeys;
    dk.forEach((key) => {
      directKeys.add(key);
      if (!keyLocations.has(key)) {
        keyLocations.set(key, []);
      }
      keyLocations.get(key).push(file);
    });
    hk.forEach((key) => {
      heuristicKeys.add(key);
      if (!keyLocations.has(key)) {
        keyLocations.set(key, []);
      }
      keyLocations.get(key).push(file);
    });
  });

  return {
    directKeys: Array.from(directKeys),
    heuristicKeys: Array.from(heuristicKeys),
    keyLocations,
    dynamicPrefixes,
  };
}

// Function to check for missing translations
function findMissingTranslations(usedKeys, availableKeys) {
  return usedKeys.filter((key) => {
    return !availableKeys.includes(key);
  });
}

// Function to check for unused translations
function findUnusedTranslations(usedKeys, availableKeys) {
  return availableKeys.filter((key) => !usedKeys.includes(key));
}

// Function to find all translation files
async function findAllTranslationFiles() {
  const files = await glob("i18n/locales/*.json");
  // Filter to only include English translation file
  return files
    .filter((file) => path.basename(file, ".json") === "en")
    .map((file) => ({
      path: file,
      locale: path.basename(file, ".json"),
    }));
}

// Compare every other locale against en.json.
//
// Crowdin used to keep these in step and was removed, so nothing else notices
// when a locale drifts: the checks above only ever load `en`, and will happily
// report "0 missing" while all 16 locale files are short. Everything flagged
// here is something that breaks at runtime rather than merely reading oddly --
// a lost {placeholder} drops data out of a sentence, a changed plural-arm count
// makes vue-i18n pick the wrong form, and an empty string renders as nothing at
// all.
function checkLocaleParity(enFlat) {
  const enKeys = Object.keys(enFlat);
  const placeholders = (value) =>
    [...String(value).matchAll(/\{(\w+)\}/g)]
      .map((match) => match[1])
      .sort()
      .join(",");
  // vue-i18n splits plural forms on "|", so the arm count has to match or the
  // wrong form is selected at runtime.
  const pluralArms = (value) => String(value).split("|").length;

  const localeFiles = fs
    .readdirSync("i18n/locales")
    .filter((file) => file.endsWith(".json") && file !== "en.json")
    .sort();

  const results = localeFiles.map((file) => {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join("i18n/locales", file), "utf8"));
    } catch (error) {
      // Named explicitly -- the bare parse error reports a character offset and
      // no filename, which is useless when 16 files are being read.
      throw new Error(`i18n/locales/${file} is not valid JSON: ${error.message}`);
    }

    const flat = flattenTranslations(parsed);
    const shared = enKeys.filter((key) => key in flat);

    return {
      locale: path.basename(file, ".json"),
      total: Object.keys(flat).length,
      missing: enKeys.filter((key) => !(key in flat)),
      stale: Object.keys(flat).filter((key) => !(key in enFlat)),
      placeholderMismatch: shared.filter(
        (key) => placeholders(flat[key]) !== placeholders(enFlat[key]),
      ),
      pluralMismatch: shared.filter(
        (key) =>
          pluralArms(enFlat[key]) > 1 &&
          pluralArms(flat[key]) !== pluralArms(enFlat[key]),
      ),
      empty: Object.keys(flat).filter(
        (key) => typeof flat[key] !== "string" || flat[key].trim() === "",
      ),
    };
  });

  const problemCount = (result) =>
    result.missing.length +
    result.stale.length +
    result.placeholderMismatch.length +
    result.pluralMismatch.length +
    result.empty.length;

  console.log(`\n=== Locale Parity (vs en.json, ${enKeys.length} keys) ===\n`);
  console.log(
    "locale     keys  missing  stale  placeholder  plural  empty".toUpperCase(),
  );

  for (const result of results) {
    console.log(
      [
        result.locale.padEnd(9),
        String(result.total).padStart(5),
        String(result.missing.length).padStart(8),
        String(result.stale.length).padStart(6),
        String(result.placeholderMismatch.length).padStart(12),
        String(result.pluralMismatch.length).padStart(7),
        String(result.empty.length).padStart(6),
        problemCount(result) === 0 ? "  ok" : "  FAIL",
      ].join(""),
    );
  }

  // Details only for what is broken -- a full list of missing keys for a locale
  // nobody has started yet would bury everything else.
  const SHOW = 10;
  for (const result of results.filter((r) => problemCount(r) > 0)) {
    console.log(`\n${result.locale}:`);
    const detail = (label, keys, format = (key) => key) => {
      if (!keys.length) return;
      console.log(`  ${label} (${keys.length})`);
      keys.slice(0, SHOW).forEach((key) => console.log(`    ${format(key)}`));
      if (keys.length > SHOW) {
        console.log(`    … and ${keys.length - SHOW} more`);
      }
    };
    detail("missing", result.missing);
    detail("stale (not in en.json)", result.stale);
    detail("placeholder mismatch", result.placeholderMismatch);
    detail("plural arm mismatch", result.pluralMismatch);
    detail("empty value", result.empty);
  }

  const broken = results.filter((r) => problemCount(r) > 0);
  console.log(
    `\n${results.length - broken.length}/${results.length} locales match en.json`,
  );

  return broken.length === 0;
}

// Main function
async function main() {
  // Find all translation files
  const translationFiles = await findAllTranslationFiles();

  // Read and flatten translations once so we can:
  // - Build a list of all available keys
  // - Infer valid translation key prefixes (e.g. pages.*, layouts.*, common.*)
  const translationData = translationFiles.map(({ path: filePath, locale }) => {
    const translations = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const flattenedTranslations = flattenTranslations(translations);
    return {
      locale,
      filePath,
      translations,
      flattenedTranslations,
    };
  });

  const allAvailableKeys = new Set();
  translationData.forEach(({ flattenedTranslations }) => {
    Object.keys(flattenedTranslations).forEach((key) => {
      allAvailableKeys.add(key);
    });
  });

  const keyPrefixes = Array.from(
    new Set(Array.from(allAvailableKeys).map((key) => key.split(".")[0])),
  );

  const keyPrefixPattern =
    keyPrefixes.length > 0
      ? new RegExp(`^(${keyPrefixes.join("|")})\\.`)
      : null;

  // Find all translation keys used in the project.
  // Direct keys ($t("...") calls) must exist and are subject to the missing
  // check. Heuristic keys (string literals that look like keys) only count
  // toward "used" because they may be false positives (JS expressions in
  // Vue directive attributes that happen to match the key shape).
  const { directKeys, heuristicKeys, keyLocations, dynamicPrefixes } =
    await findAllTranslationKeys(keyPrefixPattern);
  // Expand dynamic prefixes (e.g. "foo.bar.${baz}") into concrete keys based
  // on what exists in the translation files.
  const dynamicallyExpanded = new Set();
  dynamicPrefixes.forEach((prefix) => {
    allAvailableKeys.forEach((key) => {
      if (key.startsWith(prefix)) {
        dynamicallyExpanded.add(key);
      }
    });
  });
  const usedKeys = Array.from(
    new Set([...directKeys, ...heuristicKeys, ...dynamicallyExpanded]),
  );

  console.log("\n=== Translation Check Results ===\n");

  // Check each translation file.
  // Only direct $t(...) calls are flagged as missing — heuristic matches may
  // be false positives (e.g. a Vue directive expression that happens to match
  // the key shape).
  const translationResults = translationData.map(
    ({ locale, filePath, flattenedTranslations }) => {
      const availableKeys = Object.keys(flattenedTranslations);

      const missingTranslations = findMissingTranslations(
        directKeys,
        availableKeys,
      );
      const unusedTranslations = findUnusedTranslations(
        usedKeys,
        availableKeys,
      );

      return {
        locale,
        filePath,
        missingTranslations,
        unusedTranslations,
        availableKeys,
      };
    },
  );

  // Process results
  translationResults.forEach(
    ({
      locale,
      filePath,
      missingTranslations,
      unusedTranslations,
      availableKeys,
    }) => {
      console.log(`\nChecking ${locale} translations:`);

      if (missingTranslations.length > 0) {
        console.log("\nMissing Translations:");
        missingTranslations.forEach((key) => {
          console.log(`  - ${key}`);
          console.log(`    Used in:`);
          keyLocations.get(key).forEach((location) => {
            console.log(`      ${location}`);
          });
        });
      } else {
        console.log("\nNo missing translations found.");
      }

      if (unusedTranslations.length > 0) {
        console.log("\nUnused Translations:");
        unusedTranslations.forEach((key) => {
          console.log(`  - ${key}`);
        });
      } else {
        console.log("\nNo unused translations found.");
      }

      console.log("\nSummary:");
      console.log(`Total available translations: ${availableKeys.length}`);
      console.log(`Total used translations: ${usedKeys.length}`);
      console.log(`Missing translations: ${missingTranslations.length}`);
      console.log(`Unused translations: ${unusedTranslations.length}`);

      if (missingTranslations.length > 0) {
        process.exitCode = 1;
      }
    },
  );

  // Unused keys are noise, not breakage, so they never fail the run. Missing
  // keys and locale drift do.
  const enTranslations = translationData.find((entry) => entry.locale === "en");
  if (enTranslations && !checkLocaleParity(enTranslations.flattenedTranslations)) {
    process.exitCode = 1;
  }
}

// A crash here used to print a stack trace and still exit 0, which meant a
// malformed locale file passed CI green. Anything that throws is a failure.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
