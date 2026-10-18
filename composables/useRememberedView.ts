import { reactive, watch } from "vue";

export type ViewValidators<T> = {
  [K in keyof T]?: (value: unknown) => boolean;
};

export const rememberedViewStorageKey = (key: string) => `admin-view:${key}`;
const storageKey = rememberedViewStorageKey;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// Without a validator a stored field must have its default's shape: same
// typeof, and an array where the default is one.
function sameShape(value: unknown, fallback: unknown) {
  if (Array.isArray(fallback)) return Array.isArray(value);
  if (fallback === null) return value === null;
  return (
    typeof value === typeof fallback && value !== null && !Array.isArray(value)
  );
}

/**
 * The stored view for `key`, field by field: a field that is missing, fails
 * its validator or has the wrong shape falls back to its default, and fields
 * `defaults` doesn't name are dropped. Unreadable storage returns the
 * defaults.
 */
export function readRememberedView<T extends Record<string, unknown>>(
  key: string,
  defaults: T,
  validate: ViewValidators<T> = {},
): T {
  const view = clone(defaults);
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(key)) || "null");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return view;
    }
    for (const field of Object.keys(defaults) as Array<keyof T>) {
      if (!(field in raw)) continue;
      const value = raw[field];
      const check = validate[field];
      if (check ? check(value) : sameShape(value, defaults[field])) {
        view[field] = value;
      }
    }
  } catch {
    return clone(defaults);
  }
  return view;
}

/** Stores the fields `defaults` names; the rest never reach storage. */
export function saveRememberedView<T extends Record<string, unknown>>(
  key: string,
  view: T,
  defaults: T,
) {
  try {
    const known = Object.fromEntries(
      Object.keys(defaults).map((field) => [field, view[field]]),
    );
    localStorage.setItem(storageKey(key), JSON.stringify(known));
  } catch {}
}

/**
 * A list's view (search, filters, sort, tab) that survives a refresh or a
 * return, stored under `admin-view:<key>`. Edit the returned object like any
 * reactive state; every change is saved. Reset with
 * `Object.assign(view, freshDefaults())`.
 *
 *   const view = useRememberedView("regions", { search: "", sort: "name" }, {
 *     validate: { sort: (v) => v === "name" || v === "nodes" },
 *   });
 */
export function useRememberedView<T extends Record<string, unknown>>(
  key: string,
  defaults: T,
  options: { validate?: ViewValidators<T> } = {},
): T {
  const view = reactive(
    readRememberedView(key, defaults, options.validate),
  ) as T;
  watch(view, () => saveRememberedView(key, view, defaults), { deep: true });
  return view;
}
