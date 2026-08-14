<script setup lang="ts">
import { computed } from "vue";
import CallTile from "~/components/voice/CallTile.vue";
import CallVoiceRow from "~/components/voice/CallVoiceRow.vue";
import { useVoiceVideoPrefs } from "~/composables/useVoiceVideoPrefs";
import type { VoiceParticipant } from "~/composables/useVoiceApi";

// Props in, tiles out, no connections of its own -- so it mounts identically in
// the page and inside a picture-in-picture window, and moving between the two
// costs nothing.
const props = defineProps<{
  participants: Array<VoiceParticipant>;
  peerVideo: Map<string, MediaStream>;
  localVideo: MediaStream | null;
  mySteamId: string | null;
  // Your own mute, which the participant list cannot know: the gate mutes by
  // gain, so the server still sees you publishing the whole time.
  selfMuted?: boolean;
  // Passed down so your own mute can live on your own tile.
  onToggleSelfMute?: () => void;
  // Beyond this many, the rest stay as avatars. Five tiles of decode next to a
  // game and a live stream is already a lot to ask of a player's machine.
  maxTiles?: number;
  // The hub column, ~300px. Two tiles across rather than the wide grid -- and
  // never the fixed-width strip this used to be, which left a 112px tile
  // stranded against 180px of empty column whenever somebody was alone in the
  // channel. Tiles fill the width they are given.
  compact?: boolean;
  // You are in this call, the roster just has not arrived yet.
  //
  // There is a beat between joining and the first participant push where this
  // component has an empty list and no way to tell "nobody is here" from "I
  // have not been told yet". It was answering with the empty state -- a tall
  // block that appeared for a few hundred milliseconds and was then replaced by
  // a single row, which is the card growing to twice its height and snapping
  // back. While this is set it says nothing instead.
  awaiting?: boolean;
}>();

const MAX_TILES = 6;

const videoPrefs = useVoiceVideoPrefs();

function isMe(steamId: string) {
  return !!props.mySteamId && steamId === props.mySteamId;
}

// Everyone in the channel, whether or not they have a camera on. Gating this on
// video meant that until somebody turned one on there was nothing here at all --
// and worse, the person who did turn theirs on was invisible to everyone who
// had not. The roster is the point; video is a property of a member, not the
// reason to draw them.
//
// Ourselves last: your own mirror is the one tile you least need to look at,
// and putting it at the end keeps the grid stable as people come and go.
const ordered = computed(() =>
  [...props.participants]
    .filter((participant) => participant.connected || participant.video)
    .sort((left, right) => {
      if (isMe(left.steamId)) return 1;
      if (isMe(right.steamId)) return -1;
      return (left.name ?? "").localeCompare(right.name ?? "");
    }),
);

// Split by whether there is actually a picture to show.
//
// A member on a microphone alone was being given a 16:9 tile with their avatar
// floating in the middle -- the shape of a video, reserved for a video that
// does not exist. Four of those filled a column with black rectangles while
// still making "who is talking" hard to read. Cameras get tiles; voices get
// rows, which is a quarter of the height and says more.
function hasCamera(participant: VoiceParticipant) {
  if (isMe(participant.steamId)) {
    return !!props.localVideo;
  }

  return participant.video && !videoPrefs.isHidden(participant.steamId);
}

// Only cameras are capped: the cap exists because decoding video next to a game
// is expensive, and a row costs nothing to draw.
const cameras = computed(() =>
  ordered.value
    .filter(hasCamera)
    .slice(0, props.maxTiles ?? MAX_TILES),
);

const voices = computed(() =>
  ordered.value.filter(
    (participant) =>
      !cameras.value.some((tile) => tile.steamId === participant.steamId),
  ),
);

const shown = computed(() => cameras.value);
const overflow = computed(() => 0);

function streamFor(participant: VoiceParticipant) {
  // Your own camera is not shown back to you unless you ask. Watching yourself
  // is a distraction mid-match, and it costs a decode for a picture you already
  // know -- every other tile is someone you actually need to look at.
  if (isMe(participant.steamId)) {
    return videoPrefs.prefs.value.showSelf ? props.localVideo : null;
  }

  return props.peerVideo.get(participant.steamId) ?? null;
}

const columns = computed(() => {
  const count = shown.value.length;

  if (count <= 1) {
    return "grid-cols-1";
  }

  if (props.compact) {
    return "grid-cols-2";
  }

  if (count <= 4) {
    return "grid-cols-2";
  }

  return "grid-cols-2 lg:grid-cols-3";
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <!-- People arriving and leaving is the whole event this panel exists to
         show, and it used to happen between two frames. Two stages, deliberately
         sequential: the tile fades and shrinks out of its cell, and only once it
         is gone do the remaining tiles slide into the space. Overlapping them
         reads as a glitch -- the grid appearing to shuffle for no reason. -->
    <!-- Turning a camera on adds a 16:9 tile, which is a large step in height
         for a panel that was a list of rows a moment ago. The grid-rows collapse
         is the same one the draft room's docks use, so the section grows into
         the space rather than appearing at full size and shoving everything
         below it down a frame later. -->
    <Transition name="call-collapse">
      <div v-if="shown.length" class="grid grid-rows-[1fr]">
        <div class="call-collapse-clip">
    <TransitionGroup
      appear
      tag="div"
      :class="['grid gap-2', compact ? '' : 'min-h-0', columns]"
      enter-active-class="transition-[opacity,transform] [transition-duration:320ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      leave-active-class="transition-[opacity,transform] [transition-duration:200ms] ease-in motion-reduce:![transition-duration:1ms]"
      move-class="transition-transform [transition-duration:320ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      enter-from-class="opacity-0 scale-90 translate-y-1"
      leave-to-class="opacity-0 scale-90"
    >
      <CallTile
        v-for="participant in shown"
        :key="participant.steamId"
        :participant="participant"
        :stream="streamFor(participant)"
        :is-me="isMe(participant.steamId)"
        :mirrored="isMe(participant.steamId)"
        :self-muted="selfMuted"
        :self-video-on="!!localVideo"
        :on-toggle-self-mute="onToggleSelfMute"
        :compact="compact"
      />
    </TransitionGroup>
        </div>
      </div>
    </Transition>

    <!-- Everyone without a camera, at a size that suits a voice: name, level,
         and the fader for them. -->
    <!-- Rows collapse rather than being pulled out of flow.
         `position: absolute` looked like the way to let the rows below slide up
         during the fade, but an absolutely positioned child of a *flex*
         container does not keep its place: its static position resets to the
         container's content-box origin, so the leaving row jumped to the top of
         the list and faded there, on top of its neighbour. Collapsing the row's
         own height keeps it exactly where it is and closes the gap over the
         same duration, which is what the absolute version was trying to buy. -->
    <TransitionGroup
      appear
      tag="div"
      class="flex flex-col gap-1.5 empty:hidden"
      enter-active-class="transition-[opacity,transform] [transition-duration:300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      leave-active-class="voice-row-leave"
      move-class="transition-transform [transition-duration:300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
      leave-to-class="voice-row-leave-to"
    >
      <!-- Your own row, before the server has said so.
           There is a beat between joining and the first participant push. Kept
           inside the group so it hands over: it leaves as the real row enters,
           both animating, instead of blinking out and leaving a gap while the
           row fades in over it. -->
      <div
        v-if="awaiting && !shown.length && !voices.length"
        key="pending"
        class="grid grid-rows-[1fr]"
      >
        <div class="min-h-0">
          <div
            class="flex items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-2.5 py-2"
            aria-hidden="true"
          >
            <span
              class="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-800"
            ></span>
            <span class="h-2.5 w-24 animate-pulse rounded-full bg-zinc-800"></span>
          </div>
        </div>
      </div>

      <div
        v-for="participant in voices"
        :key="participant.steamId"
        class="grid grid-rows-[1fr]"
      >
        <div class="min-h-0">
          <CallVoiceRow
            :participant="participant"
            :is-me="isMe(participant.steamId)"
            :self-muted="selfMuted"
            :on-toggle-self-mute="
              isMe(participant.steamId) ? onToggleSelfMute : undefined
            "
          />
        </div>
      </div>
    </TransitionGroup>

    <!-- Nobody is publishing anything yet -- not even a microphone. -->
    <Transition
      enter-active-class="transition-opacity [transition-duration:300ms] [transition-delay:120ms] motion-reduce:![transition-duration:1ms]"
      leave-active-class="transition-opacity [transition-duration:120ms] motion-reduce:![transition-duration:1ms]"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
    <div
      v-if="!shown.length && !voices.length && !awaiting"
      class="flex flex-col items-center justify-center px-4 py-3 text-center"
    >
      <p class="text-[11px] leading-relaxed text-muted-foreground/70">
        {{ $t("voice.call.nobody_yet") }}
      </p>
    </div>
    </Transition>

    <p
      v-if="overflow > 0"
      class="shrink-0 text-center font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground/60"
    >
      {{ $t("voice.call.more_members", { count: overflow }) }}
    </p>
  </div>
</template>

<style scoped>
/* A leaving row shrinks its own height to nothing, in place. grid-template-rows
   rather than max-height so there is no magic number to outgrow. Clipped only
   while leaving -- permanently, it would cut the speaking ring off every row. */
.voice-row-leave {
  transition:
    grid-template-rows 0.26s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.09s ease;
}
.voice-row-leave > * {
  overflow: hidden;
}
.voice-row-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .voice-row-leave {
    transition-duration: 1ms;
  }
}

/* Height that animates, via grid-template-rows rather than max-height -- no
   magic number to outgrow when a fifth person turns their camera on. */
.call-collapse-enter-active,
.call-collapse-leave-active {
  transition:
    grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.22s ease;
}
.call-collapse-enter-from,
.call-collapse-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
/* Clipped only while animating: left on, it would cut the speaking ring off a
   tile at the edge of the grid. */
.call-collapse-enter-active .call-collapse-clip,
.call-collapse-leave-active .call-collapse-clip {
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .call-collapse-enter-active,
  .call-collapse-leave-active {
    transition-duration: 1ms;
  }
}
</style>
