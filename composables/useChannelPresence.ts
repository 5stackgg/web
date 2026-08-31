import {
  ref,
  shallowRef,
  computed,
  watch,
  onScopeDispose,
  type Ref,
} from "vue";
import {
  fetchVoiceParticipants,
  type VoiceParticipant,
} from "~/composables/useVoiceApi";
import socket from "~/web-sockets/Socket";

// Who is in a voice channel, whether or not *you* are.
//
// useVoiceChat's participant list only exists once you have joined -- it is the
// state of a call you are in. This is the state of a call you can see from
// outside, which is what a surface offering to join one needs: a section that
// only appears when somebody is actually talking cannot wait until you are
// already talking to find out.
//
// Seeded once from the API, then kept current by the same `voice:participants`
// push the API sends to every *member* of a channel. No polling: the push is
// already there, and it is the same one the announcer listens to.
//
// Shared per channel rather than per caller. The same channel is now drawn in
// several places at once -- the hub panel, the match page and the card's own
// roster preview can all be mounted together -- and one seed fetch and one
// socket listener serve all of them. Refcounted, so the last one out tears it
// down.

type Entry = {
  participants: Ref<Array<VoiceParticipant>>;
  loaded: Ref<boolean>;
  users: number;
};

const entries = new Map<string, Entry>();

const EMPTY: Array<VoiceParticipant> = [];

// One listener for every channel, not one per channel: the socket delivers a
// channel id with each push, so routing is a map lookup.
let listener: { stop: () => void } | null = null;
let closedListener: { stop: () => void } | null = null;

function listen() {
  if (listener) {
    return;
  }

  listener = socket.listen(
    "voice:participants",
    (data: { channelId: string; participants: Array<VoiceParticipant> }) => {
      const entry = data?.channelId ? entries.get(data.channelId) : null;

      if (!entry) {
        return;
      }

      entry.participants.value = data.participants ?? [];
      entry.loaded.value = true;
    },
  );

  // The channel is gone, not merely empty. Same end state either way for a
  // surface drawing it from outside, and there will be no further participant
  // push to arrive at.
  closedListener = socket.listen(
    "voice:closed",
    (data: { channelId: string }) => {
      const entry = data?.channelId ? entries.get(data.channelId) : null;

      if (!entry) {
        return;
      }

      entry.participants.value = [];
      entry.loaded.value = true;
    },
  );
}

async function seed(id: string, entry: Entry) {
  try {
    const next = await fetchVoiceParticipants(id);

    // Torn down while the request was in flight.
    if (entries.get(id) !== entry) {
      return;
    }

    entry.participants.value = next;
  } catch {
    // Not a member, or the API is unreachable. An empty roster reads as
    // "nobody is in there", which is the safe way to be wrong: the section
    // stays hidden rather than appearing empty.
    if (entries.get(id) === entry) {
      entry.participants.value = [];
    }
  } finally {
    if (entries.get(id) === entry) {
      entry.loaded.value = true;
    }
  }
}

function acquire(id: string) {
  let entry = entries.get(id);

  if (!entry) {
    entry = {
      participants: ref<Array<VoiceParticipant>>([]),
      loaded: ref(false),
      users: 0,
    };

    entries.set(id, entry);
    listen();
    void seed(id, entry);
  }

  entry.users += 1;

  return entry;
}

function release(id: string) {
  const entry = entries.get(id);

  if (!entry) {
    return;
  }

  entry.users -= 1;

  if (entry.users > 0) {
    return;
  }

  entries.delete(id);

  if (entries.size === 0) {
    listener?.stop();
    listener = null;
    closedListener?.stop();
    closedListener = null;
  }
}

export function useChannelPresence(channelId: () => string | null | undefined) {
  // shallowRef, not ref. A plain ref deep-converts what it holds through
  // reactive(), and reactive() auto-unwraps refs sitting inside an object -- so
  // `current.value.participants` came back as the array itself and `.value` on
  // it was undefined. Every roster in the app silently read empty.
  const current = shallowRef<Entry | null>(null);

  watch(
    channelId,
    (id, previous) => {
      if (previous) {
        release(previous);
      }

      current.value = id ? acquire(id) : null;
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    const id = channelId();

    if (id) {
      release(id);
    }
  });

  return {
    participants: computed(() => current.value?.participants.value ?? EMPTY),
    loaded: computed(() => current.value?.loaded.value ?? false),
  };
}
