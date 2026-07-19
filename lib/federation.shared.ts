import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Resolve a dependency's installed version.
 *
 * vite-plugin-federation resolves this itself, but only via
 * `resolve("<pkg>/package.json")` — which fails for any package that doesn't
 * list "./package.json" in its exports map (@vueuse/core, clsx, tailwind-merge
 * and class-variance-authority all don't), erroring the dev server with "No
 * description file or no version in description file". Supplying `version` up
 * front makes it skip that lookup entirely. So resolve the entry point and walk
 * up to the manifest instead, which no exports map can block.
 */
function versionOf(pkg: string): string {
  let dir = dirname(require.resolve(pkg));
  for (;;) {
    try {
      const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      if (json.name === pkg && json.version) {
        return json.version;
      }
    } catch {
      // keep walking — not every ancestor directory has a manifest
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`federation: could not resolve a version for "${pkg}"`);
    }
    dir = parent;
  }
}

/**
 * Module Federation shared singletons. The host (this web app) and every
 * plugin remote MUST declare the same set so exactly one instance of each is
 * loaded at runtime — a second copy of vue/pinia/reka-ui breaks reactivity and
 * component context. Remotes should pin these to the versions in web's
 * package.json (see the Plugins docs).
 *
 * Only packages the host itself depends on can be listed — federation turns
 * each entry into a rollup entry module, so a package web doesn't install
 * (e.g. `@5stack/ui`) fails the build. Remotes still share those among
 * themselves; the first remote to load one provides the singleton.
 */
export const FEDERATION_SHARED = Object.fromEntries(
  [
    "vue",
    "vue-router",
    "pinia",
    "reka-ui",
    "@vueuse/core",
    "lucide-vue-next",
    "class-variance-authority",
    "tailwind-merge",
    "clsx",
  ].map((pkg) => [
    pkg,
    { singleton: true, requiredVersion: false, version: versionOf(pkg) },
  ]),
);
