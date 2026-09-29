import { ref } from "vue";

export type TabFlashKind = "admin_call" | "match_found" | "chat" | "bell";

export const TAB_FLASH_KINDS: TabFlashKind[] = [
  "match_found",
  "admin_call",
  "chat",
  "bell",
];

const STORAGE_KEYS: Record<TabFlashKind, string> = {
  match_found: "5stack:tab-flash:match-found",
  admin_call: "5stack:tab-flash:admin-call",
  chat: "5stack:tab-flash:chat",
  bell: "5stack:tab-flash:bell",
};

// Where storage is blocked the choice still has to hold for this page's life.
const unsaved: Partial<Record<TabFlashKind, boolean>> = {};

// Read at signal time rather than cached, so a toggle in another 5stack tab on
// the same device applies here without a reload.
export function isTabFlashEnabled(kind: TabFlashKind): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS[kind]);
    if (stored !== null) {
      return stored !== "false";
    }
  } catch {
    // Blocked storage falls through to the in-memory choice.
  }

  return unsaved[kind] ?? true;
}

export function useTabFlashSettings() {
  const enabled = ref(
    Object.fromEntries(
      TAB_FLASH_KINDS.map((kind) => [kind, isTabFlashEnabled(kind)]),
    ) as Record<TabFlashKind, boolean>,
  );

  function setEnabled(kind: TabFlashKind, value: boolean) {
    enabled.value = { ...enabled.value, [kind]: value };
    unsaved[kind] = value;

    try {
      localStorage.setItem(STORAGE_KEYS[kind], String(value));
    } catch {}
  }

  return { enabled, setEnabled };
}
