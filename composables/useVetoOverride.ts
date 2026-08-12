import { computed, ref } from "vue";

// The toggle lives in the admin dock but is read by the veto components, which
// are siblings rather than descendants of it — so the flag is held here instead
// of being provided down a tree neither one owns. Keyed by match so switching
// matches (or leaving a draft room) never inherits a stale override.
const overrides = ref<Record<string, boolean>>({});

export function isVetoOverrideEnabled(matchId?: string): boolean {
  return matchId ? overrides.value[matchId] === true : false;
}

export function useVetoOverride(matchId: () => string | undefined) {
  const enabled = computed({
    get() {
      return isVetoOverrideEnabled(matchId());
    },
    set(value: boolean) {
      const id = matchId();
      if (!id) {
        return;
      }
      overrides.value = { ...overrides.value, [id]: value };
    },
  });

  return { enabled };
}
