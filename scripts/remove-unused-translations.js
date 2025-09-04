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

// Function to remove a key from a nested object
function removeKeyFromObject(obj, keyPath) {
  const keys = keyPath.split(".");
  let current = obj;

  // Navigate to the parent of the key to remove
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) return obj;
    current = current[keys[i]];
  }

  // Remove the key
  const lastKey = keys[keys.length - 1];
  if (current[lastKey] !== undefined) {
    delete current[lastKey];
  }

  return obj;
}

// Main function
async function main() {
  // Path to the English translation file
  const enFilePath = path.resolve(__dirname, "../i18n/locales/en.json");

  // Read the English translation file
  const enTranslations = JSON.parse(fs.readFileSync(enFilePath, "utf8"));

  // Find all translation keys used in the project
  const { keys: usedKeys } = await findAllTranslationKeys();

  // Flatten the English translations
  const flattenedEnTranslations = flattenTranslations(enTranslations);

  // Find unused translations
  const unusedTranslations = Object.keys(flattenedEnTranslations).filter(
    (key) => !usedKeys.includes(key),
  );

  console.log(`Found ${unusedTranslations.length} unused translations.`);

  // Remove unused translations
  let updatedTranslations = { ...enTranslations };
  unusedTranslations.forEach((key) => {
    updatedTranslations = removeKeyFromObject(updatedTranslations, key);
  });

  // Write the updated translations back to the file
  fs.writeFileSync(
    enFilePath,
    JSON.stringify(updatedTranslations, null, 2),
    "utf8",
  );

  console.log("Unused translations have been removed from en.json");
}

// Run the script
main().catch(console.error);
