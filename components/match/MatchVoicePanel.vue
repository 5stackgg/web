<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import VoiceSettingsButton from "~/components/voice/VoiceSettingsButton.vue";
import { useVoiceChat } from "~/composables/useVoiceChat";
import type { MicPipeline } from "~/composables/useMicPipeline";

const props = defineProps<{
  // A match lineup id. The API treats it as a voice channel id exactly like a
  // lobby id, so this is scoped to one team and can never reach the other side.
  lineupId: string;
  label: string;
  // Rides the team chat's header strip instead of standing as its own card.
  // Same channel, same settings -- the voice channel and the text channel are
  // the same room, so one header owns both and nothing is duplicated below.
  inline?: boolean;
  // A microphone the surface already has open -- the camera page publishes one
  // with its video. Handed over rather than opened again so both destinations
  // share one capture, one gate and one mute.
  pipeline?: MicPipeline;
  // For surfaces that already put the gear on screen for the same microphone.
  // Two of them would open the same dialog on the same device.
  hideSettings?: boolean;
}>();

const { t } = useI18n();

// Gated here rather than at each call site: the match page and the draft room
// render the same panel on the same lineup channel, so they share the switch.
const enabled = computed(
  () => useApplicationSettingsStore().voiceChatMatchesEnabled,
);

const voice = useVoiceChat(
  () => (enabled.value ? props.lineupId : null),
  () => props.label,
  { pipeline: props.pipeline },
);

const {
  connected,
  connecting,
  muted,
  error,
  errorDetail,
  unsupported,
  participants,
  transmitting,
  conflict,
  join,
  joinSwitching,
  leave,
  toggleMute,
} = voice;

const switchPrompt = ref(false);

// Who is in the call, out of the whole lineup. The old count read as "who is
// talking" but was really this -- MediaMTX only ever knew who had a live mic.
const inCall = computed(() =>
  participants.value.filter((participant) => participant.connected),
);

// Genuinely talking, reported by each player's own gate.
const speakers = computed(() =>
  participants.value.filter((participant) => participant.speaking),
);

async function onJoin() {
  if (conflict.value) {
    switchPrompt.value = true;
    return;
  }

  await join();
}

async function confirmSwitch() {
  switchPrompt.value = false;
  await joinSwitching();
}

// The inline strip is one microphone key: off the channel it joins, on it it
// mutes. Everything the panel says in words has to fit in the hover copy, so
// the tooltip carries the action on the first line and the state underneath.
const inlineAction = computed(() => {
  if (unsupported.value) {
    return t(unsupported.value);
  }

  if (error.value) {
    return t(error.value);
  }

  if (connecting.value) {
    return t("voice.tooltip.connecting");
  }

  if (!connected.value) {
    return t("voice.tooltip.join");
  }

  return muted.value ? t("voice.tooltip.unmute") : t("voice.tooltip.mute");
});

const inlineStatus = computed(() => {
  if (unsupported.value) {
    return null;
  }

  // The panel prints the raw failure under the row; inline there is nowhere to
  // print it, so it goes here rather than only to the console.
  if (error.value) {
    return errorDetail.value;
  }

  if (!connected.value) {
    return t("voice.tooltip.join_hint");
  }

  if (muted.value) {
    return t("voice.tooltip.muted");
  }

  if (speakers.value.length) {
    return t("voice.speaking_count", { count: speakers.value.length });
  }

  return inCall.value.length > 1
    ? t("voice.tooltip.in_voice", { count: inCall.value.length })
    : t("voice.tooltip.alone");
});

// Off the channel the key is furniture. On it, it is the state readout: a lit
// shell says the mic is published, and the ring brightens while the gate is
// open -- the one thing on this row that has to be readable without hovering.
const inlineMicTone = computed(() => {
  if (error.value) {
    return "text-destructive bg-destructive/10 ring-1 ring-inset ring-destructive/40";
  }

  if (!connected.value) {
    return "text-muted-foreground hover:text-foreground";
  }

  if (muted.value) {
    return "text-destructive bg-destructive/10 ring-1 ring-inset ring-destructive/30 hover:text-destructive";
  }

  return transmitting.value
    ? "text-emerald-300 bg-emerald-400/15 ring-1 ring-inset ring-emerald-400/60 hover:text-emerald-300"
    : "text-emerald-400/90 bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/25 hover:text-emerald-300";
});

// Leaving on unmount would be wrong -- navigating between match tabs should not
// drop the channel -- but a publishing peer connection must not outlive a hard
// teardown either, and useVoiceChat already handles that on scope dispose.
onBeforeUnmount(() => {
  switchPrompt.value = false;
});
</script>

<template>
  <div
    v-if="enabled"
    :class="
      inline
        ? 'flex shrink-0 items-center gap-0.5'
        : 'rounded-lg border border-border/60 bg-card/40 p-3'
    "
  >
    <!-- Inline: the team chat header already names the room and counts who is
         in it, so voice adds keys, not a second heading. -->
    <template v-if="inline">
      <FiveStackToolTip as-child :delay-duration="120" side="top" align="end">
        <template #trigger>
          <Button
            size="xs"
            variant="ghost"
            class="h-6 w-6 rounded-full p-0 transition-colors [&_svg]:size-3.5"
            :class="inlineMicTone"
            :disabled="!!unsupported"
            :loading="connecting"
            :aria-label="inlineAction"
            @click="connected ? toggleMute() : onJoin()"
          >
            <MicOff v-if="connected && muted" />
            <Mic v-else />
          </Button>
        </template>
        <p class="font-medium">{{ inlineAction }}</p>
        <p
          v-if="inlineStatus"
          class="mt-0.5 max-w-[16rem] break-words text-[0.7rem] opacity-70"
        >
          {{ inlineStatus }}
        </p>
      </FiveStackToolTip>

      <!-- How many are actually in the channel. Sits outside the key so the
           number is readable without hovering, and so it is never mistaken for
           the chat count on the other end of the row. -->
      <span
        v-if="connected"
        class="min-w-[0.75rem] text-center font-mono text-[0.62rem] font-bold tabular-nums leading-none transition-colors"
        :class="speakers.length ? 'text-emerald-400' : 'text-muted-foreground'"
      >
        {{ inCall.length }}
      </span>

      <FiveStackToolTip
        v-if="connected"
        as-child
        :delay-duration="120"
        side="top"
        align="end"
      >
        <template #trigger>
          <Button
            size="xs"
            variant="ghost"
            class="h-6 w-6 rounded-full p-0 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive [&_svg]:size-3.5"
            :aria-label="$t('voice.tooltip.leave')"
            @click="leave"
          >
            <PhoneOff />
          </Button>
        </template>
        {{ $t("voice.tooltip.leave") }}
      </FiveStackToolTip>

      <template v-if="!unsupported && !hideSettings">
        <!-- Channel keys on one side of the hairline, the microphone itself on
             the other: the settings outlive whichever channel is open. -->
        <span class="mx-0.5 h-3 w-px bg-border/70"></span>

        <VoiceSettingsButton
          :pipeline="voice.pipeline"
          :busy-channel="conflict?.label ?? null"
          :tooltip="$t('voice.tooltip.settings')"
          class="h-6 w-6 [&_svg]:size-3.5"
          @closed="voice.stopPreview()"
        />
      </template>
    </template>

    <template v-else>
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <Volume2 class="h-4 w-4 shrink-0 text-muted-foreground" />
          <span
            class="truncate font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em]"
          >
            {{ $t("voice.team_voice") }}
          </span>
          <span
            v-if="connected"
            class="shrink-0 font-mono text-[0.62rem] tabular-nums transition-colors"
            :class="
              speakers.length ? 'text-emerald-400' : 'text-muted-foreground'
            "
            :title="
              speakers.length
                ? $t('voice.speaking_count', { count: speakers.length })
                : undefined
            "
          >
            {{ inCall.length }}/{{ participants.length }}
          </span>
        </div>

        <div class="flex shrink-0 items-center gap-1.5">
          <Button
            v-if="connected"
            size="sm"
            variant="ghost"
            class="h-8 w-8 p-0"
            :title="muted ? $t('voice.unmute') : $t('voice.mute')"
            @click="toggleMute"
          >
            <MicOff v-if="muted" class="h-4 w-4 text-destructive" />
            <Mic
              v-else
              class="h-4 w-4"
              :class="{ 'text-primary': transmitting }"
            />
          </Button>

          <Button
            v-if="connected"
            size="sm"
            variant="ghost"
            class="h-8 gap-1.5 text-destructive hover:text-destructive"
            @click="leave"
          >
            <PhoneOff class="h-3.5 w-3.5" />
            {{ $t("voice.leave") }}
          </Button>

          <Button
            v-else
            size="sm"
            variant="outline"
            class="h-8 gap-1.5"
            :disabled="!!unsupported"
            :loading="connecting"
            @click="onJoin"
          >
            <Mic class="h-3.5 w-3.5" />
            {{ $t("voice.join") }}
          </Button>

          <!-- Same device pickers, mic check and sensitivity as the party hub:
             the settings belong to the microphone, not to one surface. -->
          <VoiceSettingsButton
            v-if="!unsupported"
            :pipeline="voice.pipeline"
            :busy-channel="conflict?.label ?? null"
            class="h-8 w-8"
            @closed="voice.stopPreview()"
          />
        </div>
      </div>

      <p v-if="unsupported" class="mt-2 text-xs text-muted-foreground">
        {{ $t(unsupported) }}
      </p>

      <template v-else-if="error">
        <p class="mt-2 text-xs text-destructive">{{ $t(error) }}</p>
        <p
          v-if="errorDetail"
          class="mt-1 break-words text-[0.7rem] text-muted-foreground"
        >
          {{ errorDetail }}
        </p>
      </template>
    </template>

    <AlertDialog v-model:open="switchPrompt">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t("voice.switch_title") }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{
              $t("voice.switch_description", { channel: conflict?.label ?? "" })
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction @click="confirmSwitch">
            {{ $t("voice.switch_confirm") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
