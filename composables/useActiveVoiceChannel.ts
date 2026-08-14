import { ref, shallowRef, readonly, type Ref } from "vue";
import type { VoiceParticipant } from "~/composables/useVoiceApi";

export type ActiveVoiceChannel = {
  id: string;
  label: string;
};

// Everything a surface that does not own the connection needs to render it and
// act on it. The right hub is the reason this exists: it has to show the call
// from outside whichever page opened it, and it outlives that page.
export type VoiceSessionHandle = ActiveVoiceChannel & {
  participants: Ref<Array<VoiceParticipant>>;
  muted: Ref<boolean>;
  transmitting: Ref<boolean>;
  toggleMute: () => void;
  leave: () => Promise<void> | void;
};

// Module scope on purpose: useVoiceChat builds its own state per call site, so
// the lobby panel and a match panel are two independent connections with no
// knowledge of each other. Publishing two microphones at once is never what
// anyone wants, so a single registry decides who currently holds the mic.
const active = ref<ActiveVoiceChannel | null>(null);
const session = shallowRef<VoiceSessionHandle | null>(null);
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

    if (session.value?.id === id) {
      session.value = null;
    }
  }

  function claim(channel: ActiveVoiceChannel) {
    active.value = channel;
  }

  // Published once the connection is actually up, so a surface reading this is
  // never handed a session that is still negotiating.
  function attach(handle: VoiceSessionHandle) {
    session.value = handle;
  }

  function release(id: string) {
    if (active.value?.id === id) {
      active.value = null;
    }

    if (session.value?.id === id) {
      session.value = null;
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
    // Not wrapped: the handle is a façade of live refs and callbacks, and a
    // readonly proxy over it only makes the call sites fight their own types.
    session,
    register,
    unregister,
    claim,
    attach,
    release,
    leaveActiveUnless,
    conflictWith,
  };
}
