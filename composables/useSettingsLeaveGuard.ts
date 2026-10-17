import type { InjectionKey } from "vue";

/**
 * Provided by a shell whose pages shouldn't be left with unsaved edits. A
 * SettingsSaveBar under it blocks the route change while dirty and nudges the
 * user to save or discard instead of opening a dialog.
 */
export const SETTINGS_LEAVE_GUARD: InjectionKey<boolean> = Symbol(
  "settings-leave-guard",
);
