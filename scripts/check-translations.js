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
function extractTranslationKeys(content) {
  // Regex to match $t("...") or $t('...') with various endings and spacing, anywhere in the code
  const pattern = /\$t\s*\(\s*['"]([^'"]+)['"](?:\s*[,)])/g;
  const matches = Array.from(content.matchAll(pattern));

  // Extract keys from matches using map
  const keys = matches.map((match) => match[1]);

  return [...new Set(keys)];
}

// Function to find all translation keys in the project
async function findAllTranslationKeys() {
  const keys = new Set();
  const keyLocations = new Map();

  // Find all Vue, JS, and TS files
  const files = await glob("**/*.{vue,js,ts}", {
    ignore: ["node_modules/**", "dist/**", "scripts/**"],
  });

  // Process each file
  const fileResults = files.map((file) => {
    const content = fs.readFileSync(file, "utf8");
    const fileKeys = extractTranslationKeys(content);
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

  return { keys: Array.from(keys), keyLocations };
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

  // Find all translation keys used in the project
  const { keys: usedKeys, keyLocations } = await findAllTranslationKeys();

  console.log("\n=== Translation Check Results ===\n");

  // Check each translation file
  const translationResults = translationFiles.map(
    ({ path: filePath, locale }) => {
      // Read and flatten translations
      const translations = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const flattenedTranslations = flattenTranslations(translations);
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
