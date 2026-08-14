<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import {
  Eye,
  EyeOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-vue-next";
import { Slider } from "~/components/ui/slider";
import { useVoicePeerAudio } from "~/composables/useVoicePeerAudio";
import { useVoiceVideoPrefs } from "~/composables/useVoiceVideoPrefs";
import type { VoiceParticipant } from "~/composables/useVoiceApi";

// One member of the call, and the only thing representing them.
//
// This used to be a video thumbnail sitting above a separate list row that
// carried the name, the mute state and the fader -- the same person drawn
// twice, once with a face and once without. Everything about them lives here
// now: whether they are speaking, whether their microphone is even open,
// whether *you* have turned them down, and the fader to do it with.
const props = defineProps<{
  participant: VoiceParticipant;
  stream: MediaStream | null;
  isMe: boolean;
  // Your own tile is a mirror, so it is flipped and always silent -- hearing
  // yourself a beat late is the classic way to make a call unusable.
  mirrored?: boolean;
  // Your own mute state, which is not something the participant list knows:
  // the gate mutes by gain, so the server still sees you publishing.
  selfMuted?: boolean;
  // Your own mute, so it can be reached from your own tile rather than hunted
  // for in the header -- the tile is where you are already looking.
  onToggleSelfMute?: () => void;
  // Cramped surfaces (the hub column): smaller chrome, and the controls take
  // over the whole tile rather than a strip of it, which at ~112px wide would
  // otherwise bury the one thing telling you who you are adjusting.
  compact?: boolean;
  // Whether your own camera is actually on, which the stream cannot say: with
  // the self view off you are handed null, exactly like somebody with no camera
  // at all. Needed to know whether offering to show it makes any sense.
  selfVideoOn?: boolean;
}>();

const peerAudio = useVoicePeerAudio();
const videoPrefs = useVoiceVideoPrefs();

const videoHidden = computed(
  () => !props.isMe && videoPrefs.isHidden(props.participant.steamId),
);
const videoEl = ref<HTMLVideoElement | null>(null);

// Hover alone is not enough. In the hub column a tile is ~112px wide, which is
// a small target to hold a pointer over, and on a touch screen there is no
// hover at all -- so tapping a tile latches its controls open too.
const revealed = ref(false);

function toggleControls() {
  if (props.isMe) {
    return;
  }

  revealed.value = !revealed.value;
}

// The stream a tile actually shows. Hiding someone drops the subscription
// upstream too, so this is belt-and-braces for the beat before that lands.
const shown = computed(() => (videoHidden.value ? null : props.stream));

function bind() {
  const el = videoEl.value;

  if (!el || el.srcObject === shown.value) {
    return;
  }

  el.srcObject = shown.value;

  if (shown.value) {
    void el.play().catch(() => {});
  }
}

watch(shown, bind);
onMounted(bind);

const silenced = computed(
  () => !props.isMe && peerAudio.isMuted(props.participant.steamId),
);

// Three different things that all read as "not talking", kept apart because the
// fix for each is different: your own mute is a button here, a peer's open-but-
// quiet mic is nothing to act on, and a peer you silenced is your own doing.
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

function initials(name: string | null) {
  return (name ?? "?").trim().slice(0, 2).toUpperCase();
}
</script>

<template>
  <div
    class="group/tile relative aspect-video overflow-hidden rounded-lg border bg-zinc-950 transition-all duration-150"
    :class="[
      speaking
        ? 'border-emerald-400/80 shadow-[0_0_0_1px_rgb(52_211_153/0.35)]'
        : 'border-zinc-800',
      silenced ? 'opacity-60' : '',
      !isMe ? 'cursor-pointer' : '',
    ]"
    @click="toggleControls"
  >
    <video
      v-show="shown"
      ref="videoEl"
      class="absolute inset-0 h-full w-full object-cover"
      :class="mirrored ? '-scale-x-100' : ''"
      autoplay
      playsinline
      muted
    ></video>

    <!-- No camera. The avatar keeps the tile the same size either way, so the
         grid never reflows when somebody turns one on.
         It sits above the video, so fading it out *is* the camera turning on --
         one transition rather than two that have to agree.
         The enter is instant on purpose: a camera going OFF kills the picture
         on its own frame (the stream is gone, the video is black), so a slow
         avatar fade-in was 200ms of black tile. Cover immediately; save the
         long dissolve for the direction that has something to reveal. -->
    <Transition
      enter-active-class="transition-opacity duration-[1ms]"
      leave-active-class="transition-[opacity,transform] duration-[420ms] ease-out motion-reduce:!duration-[1ms]"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0 scale-105"
    >
    <div
      v-if="!shown"
      class="absolute inset-0 flex items-center justify-center bg-zinc-900/40"
    >
      <span class="relative">
        <img
          v-if="participant.avatarUrl"
          :src="participant.avatarUrl"
          alt=""
          class="rounded-full object-cover transition-shadow duration-100"
          :class="[
            compact ? 'h-8 w-8' : 'h-11 w-11',
            speaking ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950' : '',
          ]"
        />
        <span
          v-else
          class="flex items-center justify-center rounded-full bg-zinc-800 font-mono font-bold text-zinc-500"
          :class="[
            compact ? 'h-8 w-8 text-[0.6rem]' : 'h-11 w-11 text-xs',
            speaking ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950' : '',
          ]"
        >
          {{ initials(participant.name) }}
        </span>
      </span>
    </div>
    </Transition>

    <!-- Name and microphone state, over whichever of the two is behind it. -->
    <div
      class="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4"
    >
      <component
        :is="silenced ? VolumeX : micOff ? MicOff : Mic"
        class="h-3 w-3 shrink-0"
        :class="
          silenced
            ? 'text-destructive'
            : micOff
              ? 'text-zinc-500'
              : speaking
                ? 'text-emerald-400'
                : 'text-zinc-400'
        "
      />
      <span
        class="truncate text-[10px] font-medium leading-none text-white"
        :class="silenced ? 'line-through decoration-destructive/60' : ''"
      >
        {{ isMe ? $t("layouts.voice_panel.you") : participant.name ?? participant.steamId }}
      </span>
      <span
        v-if="participant.coach"
        class="shrink-0 font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.12em] text-white/50"
      >
        {{ $t("layouts.voice_panel.coach") }}
      </span>
    </div>

    <!-- Silence them, or just turn them down -- on the tile they belong to.
         Hidden until wanted so a wall of sliders never competes with the faces.
         Never on your own tile: turning yourself down is what mute is for. -->
    <!-- Your own mute, on your own tile. It lived only in the header, which is
         the one place you are not looking while deciding to shut up. -->
    <!-- Watching yourself back, toggled on the thing it affects. It was a menu
         item two levels away from the picture it changes, which is a long way
         to go to check your own framing. -->
    <button
      v-if="isMe && selfVideoOn"
      type="button"
      class="absolute left-1.5 top-1.5 z-10 grid place-items-center rounded-full border backdrop-blur-sm transition-colors"
      :class="[
        compact ? 'h-6 w-6' : 'h-7 w-7',
        videoPrefs.prefs.value.showSelf
          ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
          : 'border-white/20 bg-black/50 text-white/80 hover:bg-black/70 hover:text-white',
      ]"
      :aria-label="$t('voice.call.show_self')"
      @click.stop="videoPrefs.toggleShowSelf()"
    >
      <component
        :is="videoPrefs.prefs.value.showSelf ? Eye : EyeOff"
        :class="compact ? 'h-3 w-3' : 'h-3.5 w-3.5'"
      />
    </button>

    <button
      v-if="isMe && onToggleSelfMute"
      type="button"
      class="absolute right-1.5 top-1.5 z-10 grid place-items-center rounded-full border backdrop-blur-sm transition-colors"
      :class="[
        compact ? 'h-6 w-6' : 'h-7 w-7',
        selfMuted
          ? 'border-destructive/60 bg-destructive/20 text-destructive'
          : 'border-white/20 bg-black/50 text-white/80 hover:bg-black/70 hover:text-white',
      ]"
      :aria-label="
        selfMuted
          ? $t('layouts.lobby_panel.unmute')
          : $t('layouts.lobby_panel.mute')
      "
      @click.stop="onToggleSelfMute()"
    >
      <component
        :is="selfMuted ? MicOff : Mic"
        :class="compact ? 'h-3 w-3' : 'h-3.5 w-3.5'"
      />
    </button>

    <div
      v-if="!isMe"
      class="absolute inset-x-0 bottom-0 flex bg-black/85 backdrop-blur-sm transition-all duration-150"
      :class="[
        compact
          ? 'top-0 flex-col items-stretch justify-center gap-1 px-1.5'
          : 'translate-y-full items-center gap-1.5 px-2 py-1.5 group-hover/tile:translate-y-0 focus-within:translate-y-0',
        compact && !revealed
          ? 'pointer-events-none opacity-0'
          : 'opacity-100',
        !compact && revealed ? '!translate-y-0' : '',
      ]"
      @click.stop
    >
      <!-- Compact tiles lose the name bar underneath, so it is repeated here --
           adjusting the wrong person is the one mistake this panel can make. -->
      <span
        v-if="compact"
        class="truncate text-center text-[9px] font-medium leading-none text-white/70"
      >
        {{ participant.name ?? participant.steamId }}
      </span>

      <div v-if="compact" class="flex items-center gap-1">
        <button
          type="button"
          class="shrink-0 transition-colors"
          :class="videoHidden ? 'text-destructive' : 'text-zinc-300 hover:text-white'"
          :aria-label="
            videoHidden
              ? $t('voice.call.show_video')
              : $t('voice.call.hide_video')
          "
          @click="videoPrefs.toggleHidden(participant.steamId)"
        >
          <component :is="videoHidden ? VideoOff : Video" class="h-3 w-3" />
        </button>
        <button
          type="button"
          class="shrink-0 transition-colors"
          :class="silenced ? 'text-destructive' : 'text-zinc-300 hover:text-white'"
          :aria-label="
            silenced
              ? $t('layouts.voice_panel.unmute_player')
              : $t('layouts.voice_panel.mute_player')
          "
          @click="peerAudio.toggleMuted(participant.steamId)"
        >
          <component :is="silenced ? VolumeX : Volume2" class="h-3 w-3" />
        </button>
        <Slider
          :model-value="[volumePercent]"
          :min="0"
          :max="100"
          :step="5"
          :disabled="silenced"
          class="flex-1"
          :aria-label="$t('layouts.voice_panel.player_volume')"
          @update:model-value="(value) => setVolume(value?.[0])"
        />
      </div>

      <button
        v-if="!compact"
        type="button"
        class="shrink-0 transition-colors"
        :class="videoHidden ? 'text-destructive' : 'text-zinc-400 hover:text-white'"
        :aria-label="
          videoHidden
            ? $t('voice.call.show_video')
            : $t('voice.call.hide_video')
        "
        @click="videoPrefs.toggleHidden(participant.steamId)"
      >
        <component :is="videoHidden ? VideoOff : Video" class="h-3.5 w-3.5" />
      </button>

      <button
        v-if="!compact"
        type="button"
        class="shrink-0 transition-colors"
        :class="silenced ? 'text-destructive' : 'text-zinc-400 hover:text-white'"
        :aria-label="
          silenced
            ? $t('layouts.voice_panel.unmute_player')
            : $t('layouts.voice_panel.mute_player')
        "
        @click="peerAudio.toggleMuted(participant.steamId)"
      >
        <component :is="silenced ? VolumeX : Volume2" class="h-3.5 w-3.5" />
      </button>
      <Slider
        v-if="!compact"
        :model-value="[volumePercent]"
        :min="0"
        :max="100"
        :step="5"
        :disabled="silenced"
        class="flex-1"
        :aria-label="$t('layouts.voice_panel.player_volume')"
        @update:model-value="(value) => setVolume(value?.[0])"
      />
      <span
        v-if="!compact"
        class="w-7 shrink-0 text-right font-mono text-[0.55rem] tabular-nums text-zinc-500"
      >
        {{ silenced ? "—" : `${volumePercent}%` }}
      </span>
    </div>
  </div>
</template>
