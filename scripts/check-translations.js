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
  const keyLocations = new Map();
  
  // Find all Vue, JS, and TS files
  const files = await glob('**/*.{vue,js,ts}', {
    ignore: ['node_modules/**', 'dist/**', 'scripts/**']
  });

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const fileKeys = extractTranslationKeys(content);
    fileKeys.forEach(key => {
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

// Function to find all translation files
async function findAllTranslationFiles() {
  const files = await glob('i18n/locales/*.json');
  return files.map(file => ({
    path: file,
    locale: path.basename(file, '.json')
  }));
}

// Main function
async function main() {
  // Find all translation files
  const translationFiles = await findAllTranslationFiles();
  
  // Find all translation keys used in the project
  const { keys: usedKeys, keyLocations } = await findAllTranslationKeys();
  
  console.log('\n=== Translation Check Results ===\n');
  
  // Check each translation file
  for (const { path: filePath, locale } of translationFiles) {
    console.log(`\nChecking ${locale} translations:`);
    
    // Read and flatten translations
    const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const flattenedTranslations = flattenTranslations(translations);
    const availableKeys = Object.keys(flattenedTranslations);
    
    // Find missing and unused translations
    const missingTranslations = findMissingTranslations(usedKeys, availableKeys);
    const unusedTranslations = findUnusedTranslations(usedKeys, availableKeys);
    
    if (missingTranslations.length > 0) {
      console.log('\nMissing Translations:');
      missingTranslations.forEach(key => {
        console.log(`  - ${key}`);
        console.log(`    Used in:`);
        keyLocations.get(key).forEach(location => {
          console.log(`      ${location}`);
        });
      });
    } else {
      console.log('\nNo missing translations found.');
    }
    
    if (unusedTranslations.length > 0) {
      console.log('\nUnused Translations:');
      unusedTranslations.forEach(key => {
        console.log(`  - ${key}`);
      });
    } else {
      console.log('\nNo unused translations found.');
    }
    
    console.log('\nSummary:');
    console.log(`Total available translations: ${availableKeys.length}`);
    console.log(`Total used translations: ${usedKeys.length}`);
    console.log(`Missing translations: ${missingTranslations.length}`);
    console.log(`Unused translations: ${unusedTranslations.length}`);
  }
  
  // Check for inconsistencies between translation files
  if (translationFiles.length > 1) {
    console.log('\n=== Translation Consistency Check ===\n');
    
    // Get all unique keys across all files
    const allKeys = new Set();
    const translationsByLocale = new Map();
    
    for (const { path: filePath, locale } of translationFiles) {
      const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const flattenedTranslations = flattenTranslations(translations);
      translationsByLocale.set(locale, flattenedTranslations);
      
      Object.keys(flattenedTranslations).forEach(key => allKeys.add(key));
    }
    
    // Check for missing keys in each locale
    for (const locale of translationsByLocale.keys()) {
      const localeTranslations = translationsByLocale.get(locale);
      const missingKeys = Array.from(allKeys).filter(key => !localeTranslations[key]);
      
      if (missingKeys.length > 0) {
        console.log(`\nMissing keys in ${locale}:`);
        missingKeys.forEach(key => {
          console.log(`  - ${key}`);
        });
      }
    }
  }
}

// Run the script
main().catch(console.error); 