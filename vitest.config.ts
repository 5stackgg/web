import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    setupFiles: ["tests/setup.ts"],
    // The first test in a file pays for the Nuxt boot.
    testTimeout: 30000,
    // Any other default splits into two projects that boot Nuxt in one process
    // and randomly lose auto-imports; opt out per file with @vitest-environment.
    environment: "nuxt",
    environmentOptions: {
      nuxt: {
        overrides: {
          // Keeps the test boot from regenerating the dev server's .nuxt.
          buildDir: ".nuxt/vitest",
        },
      },
    },
  },
});
