/**
 * Module Federation shared singletons. The host (this web app) and every
 * plugin remote MUST declare the same set so exactly one instance of each is
 * loaded at runtime — a second copy of vue/pinia/reka-ui breaks reactivity and
 * component context. Remotes should pin these to the versions in web's
 * package.json (see the Plugins docs).
 */
export const FEDERATION_SHARED = {
  vue: { singleton: true, requiredVersion: false },
  "vue-router": { singleton: true, requiredVersion: false },
  pinia: { singleton: true, requiredVersion: false },
  "reka-ui": { singleton: true, requiredVersion: false },
  "@vueuse/core": { singleton: true, requiredVersion: false },
  "lucide-vue-next": { singleton: true, requiredVersion: false },
  "class-variance-authority": { singleton: true, requiredVersion: false },
  "tailwind-merge": { singleton: true, requiredVersion: false },
  clsx: { singleton: true, requiredVersion: false },
  "@5stack/ui": { singleton: true, requiredVersion: false },
} as const;
