import { ref, shallowRef, computed, nextTick, onScopeDispose } from "vue";
import { useVoiceChat, type VoiceChat } from "~/composables/useVoiceChat";

// Where the call actually lives.
//
// A match page and a draft room are pages you leave -- to look at a demo, to
// check a roster, to answer a message -- and until this existed, leaving one
// unmounted the panel that owned the connection and the channel went with it.
// So the session is hosted once by the app layout, which outlives every
// navigation, and a page only ever asks it to join. The right hub is then the
// place the call is controlled from, because it is the one surface that is
// always there.
//
// The camera setup page is the deliberate exception: it renders without the
// app layout, and it already holds a microphone of its own, so it keeps a local
// session and reaches the other tabs through useActiveVoiceChannel instead.

// `kind` is the one thing the id cannot tell us. A lobby id and a match lineup
// id are both uuids and the API deliberately does not care which it was handed
// -- but the per-surface video settings do, and only the caller knows.
type VoiceTarget = {
  id: string;
  label: string;
  kind: "lobby" | "match";
};

const target = ref<VoiceTarget | null>(null);
const host = shallowRef<VoiceChat | null>(null);

// Called once, by the renderless host in the layout. Everything else reads.
export function hostVoiceSession() {
  const chat = useVoiceChat(
    () => target.value?.id ?? null,
    () => target.value?.label ?? "",
    {
      kind: () => target.value?.kind ?? "match",
      videoAllowed: () => {
        const settings = useApplicationSettingsStore();

        return target.value?.kind === "lobby"
          ? settings.videoChatLobbiesEnabled
          : settings.videoChatMatchesEnabled;
      },
    },
  );

  host.value = chat;

  onScopeDispose(() => {
    if (host.value === chat) {
      host.value = null;
      target.value = null;
    }
  });

  return chat;
}

export function useVoiceSession() {
  // Pages that can be reached without the app layout have no host, and must
  // fall back rather than silently do nothing.
  const available = computed(() => !!host.value);

  const connected = computed(() => !!host.value?.connected.value);
  const connecting = computed(() => !!host.value?.connecting.value);
  const muted = computed(() => !!host.value?.muted.value);
  const transmitting = computed(() => !!host.value?.transmitting.value);
  const participants = computed(() => host.value?.participants.value ?? []);
  const error = computed(() => host.value?.error.value ?? null);
  const errorDetail = computed(() => host.value?.errorDetail.value ?? null);
  const unsupported = computed(() => host.value?.unsupported.value ?? null);
  const pipeline = computed(() => host.value?.pipeline ?? null);

  // The camera half. Read through the host rather than the registry so a
  // surface that already holds a session reference gets it from one place --
  // and so it is null, rather than stale, in a tab that is only mirroring.
  const videoAllowed = computed(() => !!host.value?.videoAllowed.value);
  const videoOn = computed(() => !!host.value?.videoEnabled.value);
  const videoStarting = computed(() => !!host.value?.videoStarting.value);
  const peerVideo = computed(
    () => host.value?.peerVideo.value ?? new Map<string, MediaStream>(),
  );

  // The channel last asked for, whether or not it came up. Errors belong to it:
  // a failed join leaves nothing connected, and the control that asked is the
  // one that has to show why.
  const targetId = computed(() => target.value?.id ?? null);

  // The channel we are actually in, as opposed to the one last asked for.
  const channel = computed<VoiceTarget | null>(() =>
    connected.value || connecting.value ? target.value : null,
  );

  function isChannel(id: string | null | undefined) {
    return !!id && channel.value?.id === id;
  }

  // Set when joining `id` would take the microphone off a channel we are
  // already in, so the caller can ask before it does.
  function conflictWith(id: string) {
    return channel.value && channel.value.id !== id ? channel.value : null;
  }

  // Retargeting tears the previous channel down -- useVoiceChat watches the id
  // -- which is exactly the switch we want; the caller is expected to have
  // asked first.
  async function join(id: string, label: string, kind: VoiceTarget["kind"]) {
    const chat = host.value;

    if (!chat) {
      return;
    }

    if (isChannel(id)) {
      return;
    }

    target.value = { id, label, kind };
    await nextTick();
    await chat.join();
  }

  async function leave() {
    await host.value?.leave();
    target.value = null;
  }

  function toggleMute() {
    host.value?.toggleMute();
  }

  function toggleVideo() {
    return host.value?.toggleVideo();
  }

  function localVideo() {
    return host.value?.localVideo() ?? null;
  }

  function stopPreview() {
    host.value?.stopPreview();
  }

  return {
    available,
    targetId,
    channel,
    connected,
    connecting,
    muted,
    transmitting,
    participants,
    error,
    errorDetail,
    unsupported,
    pipeline,
    isChannel,
    conflictWith,
    join,
    leave,
    toggleMute,
    stopPreview,
    videoAllowed,
    videoOn,
    videoStarting,
    peerVideo,
    localVideo,
    toggleVideo,
  };
}
