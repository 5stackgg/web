import { ref, readonly } from "vue";

export type ActiveVoiceChannel = {
  id: string;
  label: string;
};

// Module scope on purpose: useVoiceChat builds its own state per call site, so
// the lobby panel and a match panel are two independent connections with no
// knowledge of each other. Publishing two microphones at once is never what
// anyone wants, so a single registry decides who currently holds the mic.
const active = ref<ActiveVoiceChannel | null>(null);
const leavers = new Map<string, () => Promise<void> | void>();

export function useActiveVoiceChannel() {
  function register(id: string, leave: () => Promise<void> | void) {
    leavers.set(id, leave);
  }

  function unregister(id: string) {
    leavers.delete(id);

    if (active.value?.id === id) {
      active.value = null;
    }
  }

  function claim(channel: ActiveVoiceChannel) {
    active.value = channel;
  }

  function release(id: string) {
    if (active.value?.id === id) {
      active.value = null;
    }
  }

  // Returns the channel that was displaced so the caller can say what it just
  // disconnected from.
  async function leaveActiveUnless(id: string) {
    const current = active.value;

    if (!current || current.id === id) {
      return null;
    }

    await leavers.get(current.id)?.();
    release(current.id);

    return current;
  }

  function conflictWith(id: string) {
    return active.value && active.value.id !== id ? active.value : null;
  }

  return {
    active: readonly(active),
    register,
    unregister,
    claim,
    release,
    leaveActiveUnless,
    conflictWith,
  };
}
