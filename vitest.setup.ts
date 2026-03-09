import { ref, computed, readonly, reactive, watch, watchEffect, toRef, toRefs, nextTick } from "vue";

// Provide localStorage on window if not available (happy-dom compatibility)
if (typeof window !== "undefined" && (!window.localStorage || typeof window.localStorage.getItem !== "function")) {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (index: number) => Object.keys(store)[index] ?? null,
    },
    writable: true,
    configurable: true,
  });
}

// Provide Vue auto-imports that Nuxt normally handles
globalThis.ref = ref;
globalThis.computed = computed;
globalThis.readonly = readonly;
globalThis.reactive = reactive;
globalThis.watch = watch;
globalThis.watchEffect = watchEffect;
globalThis.toRef = toRef;
globalThis.toRefs = toRefs;
globalThis.nextTick = nextTick;
