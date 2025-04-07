import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to flatten translation object into dot notation
function flattenTranslations(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const prefixedKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      return { ...acc, ...flattenTranslations(obj[key], prefixedKey) };
    }
    return { ...acc, [prefixedKey]: obj[key] };
  }, {});
}

// Function to extract translation keys from a file
function extractTranslationKeys(content) {
  const keys = new Set();
  
  // Match t('key') or $t('key') patterns
  const tPattern = /[t$]\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = tPattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  // Match :placeholder="$t('key')" patterns
  const placeholderPattern = /:placeholder="\$t\(['"]([^'"]+)['"]\)"/g;
  while ((match = placeholderPattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  // Match template literals with translations
  const templatePattern = /\{\{\s*\$t\(['"]([^'"]+)['"]\)\s*\}\}/g;
  while ((match = templatePattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  // Match count-based translations
  const countPattern = /\$t\(['"]([^'"]+)['"]\s*,\s*{\s*count:/g;
  while ((match = countPattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  // Match parameterized translations
  const paramPattern = /\$t\(['"]([^'"]+)['"]\s*,\s*{[^}]+}\)/g;
  while ((match = paramPattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  return Array.from(keys);
}

// Function to find all translation keys in the project
async function findAllTranslationKeys() {
  const keys = new Set();
  
  // Find all Vue, JS, and TS files
  const files = await glob('**/*.{vue,js,ts}', {
    ignore: ['node_modules/**', 'dist/**', 'scripts/**']
  });

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const fileKeys = extractTranslationKeys(content);
    fileKeys.forEach(key => keys.add(key));
  });

  return Array.from(keys);
}

// Function to check for missing translations
function findMissingTranslations(usedKeys, availableKeys) {
  return usedKeys.filter(key => {
    // Filter out false positives
    if (
      /^[0-9]+$/.test(key) || // Numbers
      /^[^a-zA-Z0-9]+$/.test(key) || // Single special characters
      key.includes('<>') || // HTML-like syntax
      key === 'tailwindcss' || // Package names
      key.includes('/') // Path separators
    ) {
      return false;
    }
    return !availableKeys.includes(key);
  });
}

// Function to check for unused translations
function findUnusedTranslations(usedKeys, availableKeys) {
  return availableKeys.filter(key => !usedKeys.includes(key));
}

// Main function
async function main() {
  // Read translation file
  const translationFile = path.join(__dirname, '../i18n/locales/en.json');
  const translations = JSON.parse(fs.readFileSync(translationFile, 'utf8'));
  
  // Flatten translations
  const flattenedTranslations = flattenTranslations(translations);
  const availableKeys = Object.keys(flattenedTranslations);
  
  // Find all translation keys used in the project
  const usedKeys = await findAllTranslationKeys();
  
  // Find missing and unused translations
  const missingTranslations = findMissingTranslations(usedKeys, availableKeys);
  const unusedTranslations = findUnusedTranslations(usedKeys, availableKeys);
  
  console.log('\n=== Translation Check Results ===\n');
  
  if (missingTranslations.length > 0) {
    console.log('Missing Translations:');
    missingTranslations.forEach(key => {
      console.log(`  - ${key}`);
    });
    console.log('');
  } else {
    console.log('No missing translations found.\n');
  }
  
  if (unusedTranslations.length > 0) {
    console.log('Unused Translations:');
    unusedTranslations.forEach(key => {
      console.log(`  - ${key}`);
    });
    console.log('');
  } else {
    console.log('No unused translations found.\n');
  }
  
  console.log('Summary:');
  console.log(`Total available translations: ${availableKeys.length}`);
  console.log(`Total used translations: ${usedKeys.length}`);
  console.log(`Missing translations: ${missingTranslations.length}`);
  console.log(`Unused translations: ${unusedTranslations.length}`);
}

// Run the script
main().catch(console.error); 