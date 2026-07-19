/**
 * Singletons the panel publishes for plugin remotes to borrow, in place of
 * Module Federation `shared` (which injects top-level await and trips WebKit
 * 242740 in Safari). Populated by plugins/shared-globals.client.ts.
 */
declare global {
  interface Window {
    __5stack_shared__?: {
      vue: typeof import("vue");
    };
  }
}

export {};
