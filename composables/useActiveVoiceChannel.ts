import { ref, shallowRef, computed, readonly, watch, type Ref } from "vue";
import type { VoiceParticipant } from "~/composables/useVoiceApi";

export type ActiveVoiceChannel = {
  id: string;
  label: string;
  // Carried so a tab that never joined this channel itself can still rejoin it
  // on a handoff -- the id alone does not say whether it is a lobby or a
  // lineup, and the API deliberately does not care but the client must.
  kind?: "lobby" | "match";
};

// The call as any surface needs to render it -- plain values, because it has to
// survive a structured clone on its way to the other tabs.
export type VoiceSession = ActiveVoiceChannel & {
  participants: Array<VoiceParticipant>;
  muted: boolean;
  // The microphone is held by this tab. False means the call is running in
  // another tab of the same browser: still the player's call, still theirs to
  // mute and leave, but the commands have to travel to get there.
  owned: boolean;
};

// The camera half of a call, which -- unlike everything above -- cannot be
// mirrored. A MediaStream does not survive a structured clone, so this is only
// ever present on the controller, in the one tab actually holding the call.
// Other tabs know from the participant list who is on camera, and show avatars.
export type VoiceSessionVideo = {
  // Whether this surface offers a camera at all -- the per-surface setting,
  // decided by whoever opened the channel.
  allowed: Ref<boolean>;
  enabled: Ref<boolean>;
  starting: Ref<boolean>;
  peerVideo: Ref<Map<string, MediaStream>>;
  localVideo: () => MediaStream | null;
  toggle: () => Promise<boolean | void>;
};

// What the surface that actually holds the peer connection registers.
export type VoiceSessionController = ActiveVoiceChannel & {
  participants: Ref<Array<VoiceParticipant>>;
  muted: Ref<boolean>;
  toggleMute: () => void;
  leave: () => Promise<void> | void;
  video?: VoiceSessionVideo;
};

// Module scope on purpose: useVoiceChat builds its own state per call site, so
// the lobby panel and a match panel are two independent connections with no
// knowledge of each other. Publishing two microphones at once is never what
// anyone wants, so a single registry decides who currently holds the mic.
const active = ref<ActiveVoiceChannel | null>(null);
const controller = shallowRef<VoiceSessionController | null>(null);
const leavers = new Map<string, () => Promise<void> | void>();

// A call held by another tab. The camera setup page renders without the app
// layout -- so without the hub -- and a player who joins from there is looking
// at the hub in the tab they came from. Module state does not cross tabs, so
// the owner publishes and everybody else mirrors.
const mirrored = ref<VoiceSession | null>(null);

const BUS_NAME = "5stack:voice";

// How long a mirror waits for an owner to answer its hello before deciding
// there is nobody left holding the call. Only ever runs once per ask.
const SYNC_TIMEOUT_MS = 1200;

const bus =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(BUS_NAME);

let syncTimer: ReturnType<typeof setTimeout> | null = null;

// --- tab presence -------------------------------------------------------
//
// beforeunload cannot await, so "is there another tab that could take this
// call" has to already be known by the time it fires. A heartbeat is the
// cheapest way to know it: every tab says it exists, and entries age out well
// after the interval so a missed beat is not a missing tab.
const TAB_ID = Math.random().toString(36).slice(2);
const HEARTBEAT_MS = 4000;
// Two and a half beats. Longer was leaving ghosts: a tab that had just closed
// still counted as somewhere to hand off to, so the warning was suppressed and
// the handoff went to nobody. Departures are announced too, so this only ever
// covers a tab that died without saying so.
const TAB_TTL_MS = 10000;

const peerTabs = new Map<string, number>();

function livePeerTabs() {
  const now = Date.now();

  for (const [id, seen] of peerTabs) {
    if (now - seen > TAB_TTL_MS) {
      peerTabs.delete(id);
    }
  }

  return peerTabs.size;
}

// --- handoff ------------------------------------------------------------
//
// Closing the tab that holds the microphone hangs up on everyone else, which
// is a rotten way for a call to end -- and the only warning the platform allows
// is a generic dialog we cannot word. So instead of warning, the call is
// offered to the other tabs on the way out and one of them picks it up.
//
// Exactly one, or the party hears the same person join several times: every
// candidate claims after a short random delay, and the first claim on the bus
// wins. BroadcastChannel delivers in order, so "first" is unambiguous.
const CLAIM_JITTER_MS = 250;

type HandoffOffer = { id: string; label: string; kind?: "lobby" | "match" };

let takeOver: ((offer: HandoffOffer) => void) | null = null;
let claimTimer: ReturnType<typeof setTimeout> | null = null;
let pendingOffer: HandoffOffer | null = null;

function snapshot(): VoiceSession | null {
  const own = controller.value;

  if (!own) {
    return null;
  }

  return {
    id: own.id,
    label: own.label,
    // Carried, because the id alone cannot say whether this is a lobby or a
    // lineup and every consumer has to know: the two are gated by different
    // settings. Dropping it here made anything reading the registry fall back
    // to "match", so joining a party from the hub was checked against the match
    // setting -- and the panel rendered nothing at all when they disagreed.
    kind: own.kind,
    participants: own.participants.value,
    muted: own.muted.value,
    owned: true,
  };
}

const session = computed<VoiceSession | null>(
  () => snapshot() ?? mirrored.value,
);

// Rebuilt field by field rather than spread: `participants` comes off a ref, so
// it is a reactive proxy, and structuredClone -- which is what postMessage does
// -- cannot clone a Proxy. Spreading the snapshot carried the proxy straight
// into the message and threw DataCloneError.
function serialize(session: VoiceSession) {
  return {
    id: session.id,
    label: session.label,
    // Same reason as the snapshot, and the mirroring tab has no other way to
    // learn it -- it never opened the channel itself.
    kind: session.kind,
    muted: session.muted,
    // Whoever receives this does not hold the microphone, by definition.
    owned: false,
    participants: session.participants.map((participant) => ({
      steamId: participant.steamId,
      name: participant.name,
      avatarUrl: participant.avatarUrl,
      connected: participant.connected,
      speaking: participant.speaking,
      // The flag crosses, the picture cannot: a MediaStream is no more
      // cloneable than the proxy above, so a mirroring tab can say who is on
      // camera but has to render an avatar rather than their video.
      video: participant.video,
    })),
  } satisfies VoiceSession;
}

function publish() {
  if (!bus) {
    return;
  }

  // Only the tab holding the microphone publishes. Without this guard a mirror
  // would rebroadcast what it just received and the tabs would talk in circles.
  const own = controller.value ? snapshot() : null;

  // Telling the other tabs is a courtesy. It runs inside join(), and a failure
  // here used to propagate out and fail the join itself.
  try {
    bus.postMessage({
      type: "session",
      session: own ? serialize(own) : null,
    });
  } catch (caught) {
    console.error("[voice] could not mirror the session to other tabs", caught);
  }
}

// The participant list and the mute flag change throughout a call, and the
// other tabs are rendering them. Deliberately not the local gate: it toggles
// several times a sentence, and who is actually talking already rides the
// participants' own `speaking` flag.
watch(
  () => (controller.value ? snapshot() : null),
  () => {
    if (controller.value) {
      publish();
    }
  },
  { deep: true },
);

if (bus) {
  bus.onmessage = (event: MessageEvent) => {
    const data = event.data as
      | { type: "session"; session: VoiceSession | null }
      | { type: "hello" }
      | { type: "tab"; tabId: string }
      | { type: "tab-gone"; tabId: string }
      | { type: "command"; command: "toggleMute" | "leave" }
      | { type: "handoff"; channel: HandoffOffer }
      | { type: "claim"; tabId: string }
      | null;

    if (!data) {
      return;
    }

    if (data.type === "tab") {
      peerTabs.set(data.tabId, Date.now());
      return;
    }

    // Said on the way out, so a closed tab stops counting immediately rather
    // than lingering for a TTL as somewhere the call could have gone.
    if (data.type === "tab-gone") {
      peerTabs.delete(data.tabId);
      return;
    }

    if (data.type === "hello") {
      // Answer with our own existence as well as the session: a tab that just
      // opened has to count toward whether a handoff has anywhere to go.
      bus?.postMessage({ type: "tab", tabId: TAB_ID });

      if (controller.value) {
        publish();
      }
      return;
    }

    // The tab holding the call is going away and is offering it on. Claim it
    // after a short random delay so exactly one of us ends up taking it.
    if (data.type === "handoff") {
      // The owner is gone either way, so the mirror goes with it. Without this
      // a tab that cannot take the call over keeps rendering one that has
      // already ended.
      if (!controller.value) {
        mirrored.value = null;
      }

      if (controller.value || !takeOver) {
        return;
      }

      pendingOffer = data.channel;

      if (claimTimer) {
        clearTimeout(claimTimer);
      }

      claimTimer = setTimeout(
        () => {
          claimTimer = null;

          if (!pendingOffer) {
            return;
          }

          bus?.postMessage({ type: "claim", tabId: TAB_ID });

          const offer = pendingOffer;
          pendingOffer = null;
          takeOver?.(offer);
        },
        Math.random() * CLAIM_JITTER_MS,
      );

      return;
    }

    // Somebody else got there first. Stand down rather than joining as well.
    if (data.type === "claim") {
      if (data.tabId === TAB_ID) {
        return;
      }

      pendingOffer = null;

      if (claimTimer) {
        clearTimeout(claimTimer);
        claimTimer = null;
      }

      return;
    }

    if (data.type === "command") {
      if (!controller.value) {
        return;
      }

      if (data.command === "toggleMute") {
        controller.value.toggleMute();
      } else {
        void controller.value.leave();
      }
      return;
    }

    if (data.type === "session") {
      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }

      // A tab holding the microphone ignores mirrors: its own state is the
      // truth, and a stale echo would fight it.
      if (!controller.value) {
        mirrored.value = data.session;
      }
    }
  };
}

// A tab that just opened missed every update that came before it, and a mirror
// left behind by a tab that closed mid-call has to be able to notice.
function requestSync() {
  if (!bus || controller.value) {
    return;
  }

  bus.postMessage({ type: "hello" });

  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    syncTimer = null;

    if (!controller.value) {
      mirrored.value = null;
    }
  }, SYNC_TIMEOUT_MS);
}

if (typeof window !== "undefined") {
  requestSync();

  // Coming back to a tab is exactly when a phantom call would be noticed, so
  // that is when it re-checks rather than on a permanent timer.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      requestSync();
    }
  });

  // Say we exist, so every other tab can count us. Answered on `hello` too, so
  // a tab that opens later learns about us without waiting a full beat.
  //
  // A reload is a close followed by an open of the same tab: the outgoing page
  // says tab-gone, so by the time the new one boots there is genuinely nowhere
  // to hand off to and the warning fires as it should.
  bus?.postMessage({ type: "tab", tabId: TAB_ID });
  setInterval(() => {
    bus?.postMessage({ type: "tab", tabId: TAB_ID });
  }, HEARTBEAT_MS);

  // On the way out, hand the call on rather than just announcing its death.
  // The mirrors cannot tell "owner closed" from "owner went quiet", so the
  // owner has to say something either way -- this says the more useful thing
  // when there is anybody to say it to.
  window.addEventListener("pagehide", () => {
    const own = controller.value;

    if (!own) {
      return;
    }

    if (livePeerTabs() > 0) {
      bus?.postMessage({
        type: "handoff",
        channel: { id: own.id, label: own.label, kind: own.kind },
      });
      bus?.postMessage({ type: "tab-gone", tabId: TAB_ID });
      return;
    }

    bus?.postMessage({ type: "session", session: null });
    bus?.postMessage({ type: "tab-gone", tabId: TAB_ID });
  });

  // Asked only when closing actually costs somebody something.
  //
  // Three conditions, because this dialog cannot be worded or styled -- the
  // browser owns it entirely, and every engine shows its own generic "changes
  // you made may not be saved" whatever we pass. A prompt we cannot make
  // accurate has to be rare enough to still mean something:
  //
  //   1. This tab holds the microphone. Closing a mirror costs nothing.
  //   2. Somebody else is in the call. Leaving a room you are alone in is not
  //      an accident worth interrupting.
  //   3. There is no other tab to hand the call to. When there is, closing this
  //      one costs nobody anything -- another tab picks the call up -- so there
  //      is nothing to warn about.
  window.addEventListener("beforeunload", (event) => {
    const own = controller.value;

    if (!own) {
      return;
    }

    const others = own.participants.value.filter(
      (participant) => participant.connected,
    ).length;

    if (others < 2 || livePeerTabs() > 0) {
      return;
    }

    event.preventDefault();
    event.returnValue = "";
  });
}

export function useActiveVoiceChannel() {
  function register(id: string, leave: () => Promise<void> | void) {
    leavers.set(id, leave);
  }

  function unregister(id: string) {
    leavers.delete(id);

    if (active.value?.id === id) {
      active.value = null;
    }

    detach(id);
  }

  function claim(channel: ActiveVoiceChannel) {
    active.value = channel;
  }

  // Published once the connection is actually up, so a surface reading this is
  // never handed a session that is still negotiating.
  function attach(next: VoiceSessionController) {
    controller.value = next;
    // Whatever another tab was showing, this tab now holds the microphone.
    mirrored.value = null;
    publish();
  }

  function detach(id: string) {
    if (controller.value?.id !== id) {
      return;
    }

    controller.value = null;
    publish();
  }

  function release(id: string) {
    if (active.value?.id === id) {
      active.value = null;
    }

    detach(id);
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

  // Both act on the call wherever it actually lives, so a surface driving them
  // never has to know which tab opened it.
  function toggleSessionMute() {
    if (controller.value) {
      controller.value.toggleMute();
      return;
    }

    bus?.postMessage({ type: "command", command: "toggleMute" });
  }

  function leaveSession() {
    if (controller.value) {
      return controller.value.leave();
    }

    bus?.postMessage({ type: "command", command: "leave" });
  }

  // Null in any tab that is only mirroring the call, which is what tells a
  // surface to render avatars instead of tiles.
  const video = computed(() => controller.value?.video ?? null);

  // Registered by the surface that knows how to join -- the registry moves
  // messages, it does not know what a channel is or how to open a microphone.
  function onHandoff(handler: (offer: HandoffOffer) => void) {
    takeOver = handler;

    return () => {
      if (takeOver === handler) {
        takeOver = null;
      }
    };
  }

  return {
    active: readonly(active),
    session,
    video,
    onHandoff,
    register,
    unregister,
    claim,
    attach,
    detach,
    release,
    leaveActiveUnless,
    conflictWith,
    toggleSessionMute,
    leaveSession,
    requestSync,
  };
}
