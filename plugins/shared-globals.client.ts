import * as vue from "vue";

// The panel publishes its own Vue instance for plugin remotes to borrow.
//
// Why not Module Federation `shared`: @originjs/vite-plugin-federation rewrites
// every import of a shared package into `await importShared(...)`, which turned
// 308 of 474 chunks into async modules. Safari (WebKit 242740) throws
// "Cannot access '<x>' before initialization" whenever several modules import
// the same top-level-await module concurrently — which is exactly that shape.
// Fixed only in STP 243+, so shipping iOS carries it. See docs/plugins.md.
//
// A plain global has no top-level await, so no chunk becomes async. Remotes
// resolve bare `vue` to a synchronous virtual module that reads this object
// (see the sharedGlobals() vite plugin in the plugin template).
//
// Only `vue` is bridged: it is the one package where a second copy breaks
// things (reactivity + component context). Everything else a remote needs it
// bundles itself, and whatever it bundles that imports Vue — reka-ui,
// @5stack/ui — resolves through this same bridge, so there is still exactly
// one Vue instance in the page.
export default defineNuxtPlugin(() => {
  window.__5stack_shared__ = { vue };
});
