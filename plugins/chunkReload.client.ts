import { isChunkLoadError } from "@/utilities/imagePipeline";

const STORAGE_KEY = "chunk-reload-attempted";

function reloadOnce() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* noop */
  }
  window.location.reload();
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  });

  nuxtApp.hook("app:chunkError", () => reloadOnce());

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
