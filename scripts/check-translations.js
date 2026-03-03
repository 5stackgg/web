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
// - Direct usage via $t("..."), $t('...') or $t(`...`)
// - String literals that *look* like translation keys based on known prefixes
// - Dynamic template keys like $t(`foo.bar.${baz}`) are tracked by prefix
function extractTranslationKeys(content, keyPrefixPattern, dynamicPrefixes) {
  const keys = new Set();

  // Regex to match $t("...") / t("...") / i18n.t("...") with various endings and spacing
  const directPattern =
    /\b(?:\$t|t)\s*\(\s*(['"`])([^'"`]+)\1(?:\s*[,)])/g;
  const directMatches = Array.from(content.matchAll(directPattern));

  directMatches.forEach((match) => {
    const key = match[2];
    // If this is a dynamic template (contains ${...}), record its prefix so we
    // can later treat all matching translation keys as \"used\".
    if (key.includes("${")) {
      const prefix = key.split("${")[0];
      if (prefix && dynamicPrefixes) {
        dynamicPrefixes.add(prefix);
      }
      return;
    }
    keys.add(key);
  });

  // Also catch namespaced calls like i18n.t("foo.bar.baz")
  const namespacedTPattern =
    /\b\w+\.t\s*\(\s*(['"`])([^'"`]+)\1(?:\s*[,)])/g;
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
    keys.add(key);
  });

  // Additionally, capture string literals that look like translation keys
  // based on known prefixes from the translation files (e.g. pages.*, layouts.*, common.*, etc.)
  if (keyPrefixPattern) {
    const literalPattern = /['"]([^'"]+)['"]/g;
    const literalMatches = Array.from(content.matchAll(literalPattern));

    literalMatches.forEach((match) => {
      const candidate = match[1];
      // Heuristic: translation keys are typically lowercase with dots and at least
      // three segments (e.g. pages.leaderboard.col.elo)
      const translationKeyShape = /^[a-z0-9_]+(\.[a-z0-9_]+){2,}$/;

      if (translationKeyShape.test(candidate) && keyPrefixPattern.test(candidate)) {
        keys.add(candidate);
      }
    });
  }

  return [...keys];
}

// Function to find all translation keys in the project
async function findAllTranslationKeys(keyPrefixPattern) {
  const keys = new Set();
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
    fileKeys.forEach((key) => {
      keys.add(key);
      if (!keyLocations.has(key)) {
        keyLocations.set(key, []);
      }
      keyLocations.get(key).push(file);
    });
  });

  return { keys: Array.from(keys), keyLocations, dynamicPrefixes };
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
    new Set(
      Array.from(allAvailableKeys).map((key) => key.split(".")[0]),
    ),
  );

  const keyPrefixPattern =
    keyPrefixes.length > 0
      ? new RegExp(`^(${keyPrefixes.join("|")})\\.`)
      : null;

  // Find all translation keys used in the project
  const { keys: usedKeysRaw, keyLocations, dynamicPrefixes } =
    await findAllTranslationKeys(keyPrefixPattern);
  // Expand dynamic prefixes (e.g. \"foo.bar.${baz}\") into concrete keys based
  // on what exists in the translation files.
  const usedKeysSet = new Set(usedKeysRaw);
  dynamicPrefixes.forEach((prefix) => {
    allAvailableKeys.forEach((key) => {
      if (key.startsWith(prefix)) {
        usedKeysSet.add(key);
      }
    });
  });
  const usedKeys = Array.from(usedKeysSet);

  console.log("\n=== Translation Check Results ===\n");

  // Check each translation file
  const translationResults = translationData.map(
    ({ locale, filePath, flattenedTranslations }) => {
      const availableKeys = Object.keys(flattenedTranslations);

      // Find missing and unused translations
      const missingTranslations = findMissingTranslations(
        usedKeys,
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
    },
  );
}

// Run the script
main().catch(console.error);
