<script setup lang="ts">
import { computed } from "vue";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-vue-next";
import { Slider } from "~/components/ui/slider";
import { useVoicePeerAudio } from "~/composables/useVoicePeerAudio";
import type { VoiceParticipant } from "~/composables/useVoiceApi";

// Someone in the channel with no camera on.
//
// They used to be drawn as a 16:9 tile with an avatar floating in the middle of
// it -- the shape of a video, reserved for a video that does not exist. Four
// people on microphones filled a column with black rectangles and still made
// "who is talking" hard to read, because the one moving thing was a small ring
// around a small picture.
//
// A row instead: the name at readable size, the level meter beside it, and the
// fader in reach. This is what a voice channel actually is, and it costs a
// quarter of the height.
const props = defineProps<{
  participant: VoiceParticipant;
  isMe: boolean;
  selfMuted?: boolean;
  onToggleSelfMute?: () => void;
}>();

const peerAudio = useVoicePeerAudio();

const silenced = computed(
  () => !props.isMe && peerAudio.isMuted(props.participant.steamId),
);

// Your own mute is a gain gate, so the server still sees you publishing --
// which means the participant list cannot answer this for you.
const micOff = computed(() =>
  props.isMe ? !!props.selfMuted : !props.participant.connected,
);

const speaking = computed(
  () => props.participant.speaking && !silenced.value && !micOff.value,
);

const volumePercent = computed(() =>
  Math.round(peerAudio.volumeOf(props.participant.steamId) * 100),
);

function setVolume(value: number | undefined) {
  peerAudio.setVolume(props.participant.steamId, (value ?? 0) / 100);
}
</script>

<template>
  <div
    class="group/row flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors"
    :class="[
      speaking
        ? 'border-emerald-400/60 bg-emerald-400/[0.06]'
        : 'border-zinc-800/80 bg-zinc-900/40',
      silenced ? 'opacity-70' : '',
    ]"
  >
    <span class="relative shrink-0">
      <img
        v-if="participant.avatarUrl"
        :src="participant.avatarUrl"
        alt=""
        class="h-8 w-8 rounded-full object-cover transition-shadow duration-100"
        :class="
          speaking
            ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950'
            : ''
        "
      />
      <span
        v-else
        class="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 font-mono text-[0.6rem] font-bold text-zinc-500"
        :class="
          speaking
            ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950'
            : ''
        "
      >
        {{ (participant.name ?? "?").trim().slice(0, 2).toUpperCase() }}
      </span>
    </span>

    <!-- Them: who they are and what they are doing. Nothing here is a control,
         so nothing here is shaped like a button. -->
    <div class="flex min-w-0 flex-1 items-center gap-1.5">
      <span
        class="truncate text-xs font-medium leading-none"
        :class="speaking ? 'text-emerald-300' : 'text-zinc-200'"
      >
        {{
          isMe
            ? $t("layouts.voice_panel.you")
            : (participant.name ?? participant.steamId)
        }}
      </span>

      <span
        v-if="participant.coach"
        class="shrink-0 font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.12em] text-zinc-500"
      >
        {{ $t("layouts.voice_panel.coach") }}
      </span>

      <!-- Only ever shown when there is something to say.
           A microphone icon on every quiet row was read as a state -- it was
           just decoration, and it made the two rows that *were* muted
           indistinguishable from the ones that were fine. Quiet is the normal
           case and now looks like nothing at all. -->
      <span
        v-if="speaking"
        class="flex shrink-0 items-end gap-[2px]"
        :aria-label="$t('layouts.voice_panel.speaking')"
      >
        <span
          v-for="bar in 3"
          :key="bar"
          class="w-[2px] rounded-full bg-emerald-400 motion-reduce:!animate-none"
          :class="`call-bar call-bar-${bar}`"
        ></span>
      </span>

      <span
        v-else-if="micOff"
        class="flex shrink-0 items-center gap-1 font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.12em] text-zinc-500"
      >
        <MicOff class="h-3 w-3" />
        {{ $t("layouts.voice_panel.mic_off") }}
      </span>
    </div>

    <!-- You: what you have done to them. Separated from the left half by being
         the only thing on this row that can be pressed. -->
    <div class="flex shrink-0 items-center gap-2">
      <!-- Replaces the fader rather than disabling it. A greyed-out slider
           still reads as a volume you might nudge; the word does not. -->
      <span
        v-if="silenced"
        class="font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.14em] text-destructive"
      >
        {{ $t("layouts.voice_panel.silenced") }}
      </span>

      <Slider
        v-else-if="!isMe"
        :model-value="[volumePercent]"
        :min="0"
        :max="100"
        :step="5"
        class="w-20"
        :aria-label="$t('layouts.voice_panel.player_volume')"
        @update:model-value="(value) => setVolume(value?.[0])"
      />

      <button
        v-if="isMe && onToggleSelfMute"
        type="button"
        class="grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors"
        :class="
          selfMuted
            ? 'border-destructive/60 bg-destructive/20 text-destructive'
            : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white'
        "
        :aria-label="
          selfMuted
            ? $t('layouts.lobby_panel.unmute')
            : $t('layouts.lobby_panel.mute')
        "
        @click="onToggleSelfMute()"
      >
        <component :is="selfMuted ? MicOff : Mic" class="h-3.5 w-3.5" />
      </button>

      <button
        v-else-if="!isMe"
        type="button"
        class="grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors"
        :class="
          silenced
            ? 'border-destructive/60 bg-destructive/20 text-destructive hover:bg-destructive/30'
            : 'border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-100'
        "
        :aria-label="
          silenced
            ? $t('layouts.voice_panel.unmute_player')
            : $t('layouts.voice_panel.mute_player')
        "
        @click="peerAudio.toggleMuted(participant.steamId)"
      >
        <component :is="silenced ? VolumeX : Volume2" class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Three bars at different phases so it reads as a level meter rather than a
   blinking light. Heights are small on purpose -- this sits on a text line. */
.call-bar {
  animation: call-bar 900ms ease-in-out infinite;
}
.call-bar-1 {
  animation-delay: 0ms;
}
.call-bar-2 {
  animation-delay: 150ms;
}
.call-bar-3 {
  animation-delay: 300ms;
}
@keyframes call-bar {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 11px;
  }
}
</style>
