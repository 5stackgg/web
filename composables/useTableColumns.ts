import { ref, watch, type Ref } from "vue";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

interface ColumnState {
  visibility: Ref<Record<string, boolean>>;
  columns: ColumnDef[];
  toggle: (key: string) => void;
  reset: () => void;
}

const STORAGE_PREFIX = "5stack:table-cols:";
const states = new Map<string, ColumnState>();

function readStored(key: string): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable (private mode, quota). Silently ignore —
    // visibility just won't persist across reloads.
  }
}

function buildDefaults(columns: ColumnDef[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const col of columns) {
    out[col.key] = col.defaultVisible !== false;
  }
  return out;
}

export function useTableColumns(
  storageKey: string,
  columns: ColumnDef[],
): ColumnState {
  const cached = states.get(storageKey);
  if (cached) return cached;

  const defaults = buildDefaults(columns);
  const stored = readStored(storageKey) ?? {};
  const initial: Record<string, boolean> = { ...defaults };
  for (const key of Object.keys(stored)) {
    if (key in initial && typeof stored[key] === "boolean") {
      initial[key] = stored[key];
    }
  }

  const visibility = ref<Record<string, boolean>>(initial);

  watch(
    visibility,
    (next) => {
      writeStored(storageKey, next);
    },
    { deep: true },
  );

  const state: ColumnState = {
    visibility,
    columns,
    toggle(key: string) {
      visibility.value = {
        ...visibility.value,
        [key]: !visibility.value[key],
      };
    },
    reset() {
      visibility.value = { ...defaults };
    },
  };

  states.set(storageKey, state);
  return state;
}
