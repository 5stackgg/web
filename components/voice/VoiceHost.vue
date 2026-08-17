<script setup lang="ts">
import { onScopeDispose } from "vue";
import {
  hostVoiceSession,
  useVoiceSession,
} from "~/composables/useVoiceSession";
import { useVoiceAnnouncements } from "~/composables/useVoiceAnnouncements";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { useCallPip, useCallPipHost } from "~/composables/useCallPip";
import CallFloatingPanel from "~/components/voice/CallFloatingPanel.vue";
import { useCallVisibility } from "~/composables/useCallVisibility";
import { useVoiceVideoPrefs } from "~/composables/useVoiceVideoPrefs";
import { toast } from "~/components/ui/toast";

// Renders nothing. It exists to own the voice connection somewhere that
// outlives page navigation -- the app layout -- so that walking off a match
// page does not hang up on your team. Every control anywhere else drives this
// one session through useVoiceSession.
hostVoiceSession();

// Mounted here for the same reason the session is: it has to outlive page
// navigation, and it has to run whether or not the player is in a call -- being
// told your team started talking is only useful when you are not already there.
useVoiceAnnouncements();

// Catching a call handed over by a tab that is closing.
//
// The registry does the electing -- exactly one tab claims -- and this is the
// half that knows what a channel is and how to open a microphone. Permission is
// already granted for the origin, so getUserMedia resolves without a prompt;
// the player never sees a gesture request they did not initiate.
//
// Told about it either way: a call that silently moved would be a microphone
// opening in a window they were not looking at.
const session = useVoiceSession();
const { t } = useI18n();

// Picture-in-Picture, hosted once. Every panel used to build its own, which
// meant two canvases compositing the same call and two things deciding whether
// to open a window. Here it sits beside the session it draws, and follows the
// visibility registry rather than any one surface's idea of being on screen --
// walking off a match page is the case a single panel could never see.
const visibility = useCallVisibility();
const videoPrefs = useVoiceVideoPrefs();

useCallPipHost({
  participants: () => session.participants.value,
  peerVideo: () => session.peerVideo.value,
  localVideo: () => session.localVideo(),
  mySteamId: () => useAuthStore().me?.steam_id ?? null,
  selfMuted: () => session.muted.value,
  channelId: () => session.channel.value?.id ?? null,
  onScreen: () => visibility.visible.value,
  // Anyone on camera makes this a video call worth following you, including
  // yourself: having turned your own camera on is a stronger statement of
  // intent than any preference about whether you watch yourself back. Peers you
  // have explicitly hidden do not count -- you already said you did not want to
  // see them.
  hasVideo: () =>
    session.videoOn.value ||
    session.participants.value.some(
      (participant) =>
        participant.video &&
        participant.steamId !== useAuthStore().me?.steam_id &&
        !videoPrefs.isHidden(participant.steamId),
    ),
});

// Where native Picture-in-Picture does not exist, the same decision lands here
// instead: same trigger, same dismissal, a panel rather than a window.
const pip = useCallPip();

onScopeDispose(
  useActiveVoiceChannel().onHandoff(async (offer) => {
    const joined = await session
      .join(offer.id, offer.label, offer.kind ?? "match")
      .then(() => true)
      .catch(() => false);

    toast({
      title: joined
        ? t("voice.call.handoff_taken", { channel: offer.label })
        : t("voice.call.handoff_failed", { channel: offer.label }),
      duration: 6000,
    });
  }),
);

// The floating panel's mute key reaches the same microphone as every other one,
// so it has to mean the same thing when the phone is carrying it: muting audio
// this client is not sending would do nothing anyone could hear.
function onToggleSelfMute() {
  if (session.micElsewhere.value) {
    void session.reclaimMic();
    return;
  }

  session.toggleMute();
}
</script>

<template>
  <CallFloatingPanel
    v-if="pip.floating.value"
    :participants="session.participants.value"
    :peer-video="session.peerVideo.value"
    :local-video="session.localVideo()"
    :my-steam-id="useAuthStore().me?.steam_id ?? null"
    :self-muted="session.muted.value"
    :on-toggle-self-mute="onToggleSelfMute"
    @close="pip.toggle()"
  />
</template>
