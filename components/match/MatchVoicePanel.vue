<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from "lucide-vue-next";
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
import DeviceBadge from "~/components/voice/DeviceBadge.vue";
import VoiceSettingsButton from "~/components/voice/VoiceSettingsButton.vue";
import { useVoiceChat } from "~/composables/useVoiceChat";
import { useVoiceSession } from "~/composables/useVoiceSession";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
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

// Two ways to be wired, and only one of them is the normal one.
//
// Normally this is a control, not a connection: the session is hosted by the
// app layout so that leaving the match page does not hang up on the team, and
// everything here drives it. The exception is a surface that hands over its own
// microphone -- the camera setup page, which renders without the layout and so
// has no host to drive. That one owns its connection locally, and the page
// staying open is what keeps it alive.
const session = useVoiceSession();

const local =
  props.pipeline &&
  useVoiceChat(
    () => (enabled.value ? props.lineupId : null),
    () => props.label,
    {
      pipeline: props.pipeline,
      kind: () => "match" as const,
      videoAllowed: () => useApplicationSettingsStore().videoChatMatchesEnabled,
    },
  );

const registry = useActiveVoiceChannel();
const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

// The channel, whoever happens to be holding it: this component's own local
// session, the app-hosted one, or another tab entirely. All three mean "you are
// in it", and a control that only knew about its own session showed a Join
// button to someone already talking -- which is exactly what happened between
// the camera page and the match page.
const held = computed(() =>
  registry.session.value?.id === props.lineupId ? registry.session.value : null,
);

// Whether the microphone in this channel is one this component can reach
// directly, as opposed to one being driven over the tab bridge.
const ownedHere = computed(() =>
  local ? local.connected.value : session.isChannel(props.lineupId),
);

// One shape either way, so the template never asks which it got.
const connected = computed(() => !!held.value);
const connecting = computed(() =>
  local
    ? local.connecting.value
    : session.connecting.value && session.targetId.value === props.lineupId,
);
const muted = computed(() => held.value?.muted ?? false);

// A camera is offered wherever the microphone is. Resolved the same way as
// everything else here: this component may own the session, or be driving the
// one the app layout hosts, and the control has to work either way.
const videoOffered = computed(
  () =>
    connected.value && useApplicationSettingsStore().videoChatMatchesEnabled,
);
const videoOn = computed(() =>
  local ? local.videoEnabled.value : session.videoOn.value,
);
const videoStarting = computed(() =>
  local ? local.videoStarting.value : session.videoStarting.value,
);
// Published for this player, but from the phone that scanned the QR rather than
// from here. Toggling would take the path straight back off it, so the control
// stops being a toggle and starts being a status.
const videoElsewhere = computed(() =>
  local ? local.cameraElsewhere.value : session.videoElsewhere.value,
);
// The microphone moved to the phone. Mute here would be a control over audio
// this client is not sending, so the key reports instead of toggling.
const micElsewhere = computed(() =>
  local ? local.micElsewhere.value : session.micElsewhere.value,
);

// Badged, this is "bring it back here". Publishing from this client displaces
// whatever held the path, which is the same move the phone made to take it --
// so turning the camera on is all "take it back" has ever needed to be.
function toggleVideo() {
  void (local ? local.toggleVideo() : session.toggleVideo());
}
const participants = computed(() => held.value?.participants ?? []);
// The local gate is the truthful answer when we own the mic; otherwise the only
// thing we know is what the channel was told, which is what everyone else hears.
const transmitting = computed(() => {
  if (ownedHere.value) {
    return local ? local.transmitting.value : session.transmitting.value;
  }

  return participants.value.some(
    (participant) =>
      participant.steamId === mySteamId.value && participant.speaking,
  );
});
// One session serves every channel now, so a failure is only this control's to
// report when this control is what asked.
const owns = computed(
  () => !!local || session.targetId.value === props.lineupId,
);
const error = computed(() =>
  local ? local.error.value : owns.value ? session.error.value : null,
);
const errorDetail = computed(() =>
  local
    ? local.errorDetail.value
    : owns.value
      ? session.errorDetail.value
      : null,
);
const unsupported = computed(() =>
  local ? local.unsupported.value : session.unsupported.value,
);
const pipeline = computed(() =>
  local ? local.pipeline : session.pipeline.value,
);
// Anything holding the microphone on a different channel, wherever it lives --
// including another tab, which the local registry's `active` never sees.
const conflict = computed(() => {
  const current = registry.session.value;

  if (current && current.id !== props.lineupId) {
    return current;
  }

  return registry.conflictWith(props.lineupId);
});

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

async function join() {
  if (local) {
    await local.join();
    return;
  }

  await session.join(props.lineupId, props.label, "match");
}

// Routed to whoever actually holds the microphone. When that is another tab the
// registry relays the command over the bridge, so the control works the same
// wherever it is rendered.
async function leave() {
  if (local && local.connected.value) {
    await local.leave();
    return;
  }

  if (session.isChannel(props.lineupId)) {
    await session.leave();
    return;
  }

  await registry.leaveSession();
}

function toggleMute() {
  // Muting a microphone this client is not sending would do nothing anyone
  // could hear. Badged, the key means take it back instead.
  if (micElsewhere.value) {
    void (local ? local.reclaimMic() : session.reclaimMic());
    return;
  }

  if (local && local.connected.value) {
    local.toggleMute();
    return;
  }

  if (session.isChannel(props.lineupId)) {
    session.toggleMute();
    return;
  }

  registry.toggleSessionMute();
}

function stopPreview() {
  if (local) {
    local.stopPreview();
    return;
  }

  session.stopPreview();
}

async function onJoin() {
  if (conflict.value) {
    switchPrompt.value = true;
    return;
  }

  await join();
}

async function confirmSwitch() {
  switchPrompt.value = false;

  if (local) {
    await local.joinSwitching();
    return;
  }

  // Retargeting the hosted session drops the channel it was on, which is the
  // switch itself -- there is no second connection to take the mic from.
  await session.join(props.lineupId, props.label, "match");
}

// What the microphone key does, reachable from outside so a surface can make
// its whole row the target instead of a 24px icon.
async function activate() {
  if (unsupported.value) {
    return;
  }

  if (connected.value) {
    toggleMute();
    return;
  }

  await onJoin();
}

defineExpose({ activate, connected });

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

  if (micElsewhere.value) {
    return t("voice.call.take_mic_back");
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

  if (micElsewhere.value) {
    return t("voice.call.take_mic_back");
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
            class="relative h-6 w-6 rounded-full p-0 transition-colors [&_svg]:size-3.5"
            :class="inlineMicTone"
            :disabled="!!unsupported"
            :loading="connecting"
            :aria-label="inlineAction"
            @click="activate"
          >
            <MicOff v-if="connected && muted" />
            <Mic v-else />
            <DeviceBadge :on="connected && micElsewhere" />
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
        v-if="videoOffered"
        as-child
        :delay-duration="120"
        side="top"
        align="end"
      >
        <template #trigger>
          <Button
            size="xs"
            variant="ghost"
            class="relative h-6 w-6 rounded-full p-0 transition-colors [&_svg]:size-3.5"
            :class="
              videoOn || videoElsewhere
                ? 'text-[hsl(var(--tac-amber))] hover:text-[hsl(var(--tac-amber))]'
                : 'text-muted-foreground hover:text-foreground'
            "
            :loading="videoStarting"
            :aria-label="
              videoElsewhere
                ? $t('voice.call.take_camera_back')
                : videoOn
                  ? $t('voice.call.stop_camera')
                  : $t('voice.call.start_camera')
            "
            @click="toggleVideo"
          >
            <component :is="videoOn ? Video : VideoOff" />
            <DeviceBadge :on="videoElsewhere" />
          </Button>
        </template>
        {{
          videoElsewhere
            ? $t("voice.call.take_camera_back")
            : videoOn
              ? $t("voice.call.stop_camera")
              : $t("voice.call.start_camera")
        }}
      </FiveStackToolTip>

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

      <template v-if="!unsupported && !hideSettings && pipeline">
        <!-- Channel keys on one side of the hairline, the microphone itself on
             the other: the settings outlive whichever channel is open. -->
        <span class="mx-0.5 h-3 w-px bg-border/70"></span>

        <VoiceSettingsButton
          :pipeline="pipeline"
          :busy-channel="conflict?.label ?? null"
          :tooltip="$t('voice.tooltip.settings')"
          class="h-6 w-6 [&_svg]:size-3.5"
          @closed="stopPreview()"
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
            v-if="!unsupported && pipeline"
            :pipeline="pipeline"
            :busy-channel="conflict?.label ?? null"
            class="h-8 w-8"
            @closed="stopPreview()"
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
