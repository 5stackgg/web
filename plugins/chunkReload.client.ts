// Recover from "Failed to fetch dynamically imported module" errors after
// a deploy invalidates chunk hashes. We listen for Nuxt's chunk-error hook
// (and Vite's window-level vite:preloadError event) and force one reload
// per session so the user lands on the new build instead of a dead screen.

import { isChunkLoadError } from "@/utilities/imagePipeline";

const STORAGE_KEY = "chunk-reload-attempted";

function reloadOnce() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode etc. — still try to reload */
  }
  window.location.reload();
}

export default defineNuxtPlugin((nuxtApp) => {
  // Clear the guard once we've successfully mounted a fresh build.
  nuxtApp.hook("app:mounted", () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  });

  nuxtApp.hook("app:chunkError", () => {
    reloadOnce();
  });

  if (typeof window !== "undefined") {
    window.addEventListener("vite:preloadError", () => reloadOnce());
    window.addEventListener("error", (e) => {
      if (isChunkLoadError(e.error ?? e.message)) reloadOnce();
    });
    window.addEventListener("unhandledrejection", (e) => {
      if (isChunkLoadError(e.reason)) reloadOnce();
    });
  }
});
