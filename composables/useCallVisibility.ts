import { ref, computed, onScopeDispose } from "vue";

// Is the call on screen anywhere right now?
//
// Not the same as "a surface that can show it is mounted". The hub keeps every
// panel it has ever opened mounted and hides them with v-show, and a match page
// can be navigated away from while the session -- hosted by the layout -- keeps
// running. Neither mounting nor unmounting is the signal.
//
// So each surface says for itself. Picture-in-Picture follows the answer: the
// call goes into a floating window exactly when there is nowhere else to see
// it, which is the moment you walked away from the page that was showing it.

let nextId = 0;
const surfaces = ref(new Map<number, () => boolean>());

export function useCallVisibility() {
  // The predicate is re-read inside a computed, so whatever reactive state it
  // touches is tracked -- a sidebar opening or a hub tab changing counts.
  const visible = computed(() => {
    for (const isVisible of surfaces.value.values()) {
      if (isVisible()) {
        return true;
      }
    }

    return false;
  });

  function register(isVisible: () => boolean) {
    const id = nextId++;
    surfaces.value = new Map(surfaces.value).set(id, isVisible);

    const unregister = () => {
      if (!surfaces.value.has(id)) {
        return;
      }

      const next = new Map(surfaces.value);
      next.delete(id);
      surfaces.value = next;
    };

    onScopeDispose(unregister);

    return unregister;
  }

  return { register, visible };
}
