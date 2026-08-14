<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { Settings2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import VoiceSettingsDialog from "~/components/voice/VoiceSettingsDialog.vue";
import { useAudioSettings } from "~/composables/useAudioSettings";
import type { MicPipeline } from "~/composables/useMicPipeline";

// The gear plus everything behind it. Every surface that opens a microphone --
// the party hub, a match panel, a draft room, a player's camera feed -- gets the
// same dialog, driven by the same settings, because it is the same microphone.
const props = withDefaults(
  defineProps<{
    // The mic this surface publishes. The dialog meters and monitors through
    // it; the settings themselves are global.
    pipeline: MicPipeline;
    // Set when the microphone is already live somewhere else, so opening this
    // must not take it. The settings still apply there.
    busyChannel?: string | null;
    // The hub closes itself when the pointer leaves it, and the dialog is
    // portalled outside it, so reaching the dialog would close the panel out
    // from under it. Only the right hub needs this.
    hubAware?: boolean;
    // Some surfaces (a camera feed) hold the mic for as long as they are open,
    // so closing the dialog must not stop it.
    keepAlive?: boolean;
    // Overrides the hover copy. A gear on its own says nothing about which
    // gear it is, and on the tight surfaces there is no label beside it.
    tooltip?: string | null;
    class?: string;
  }>(),
  {
    busyChannel: null,
    hubAware: false,
    keepAlive: false,
    tooltip: null,
    class: "",
  },
);

// Closing does not release the microphone: only the surface that owns it knows
// whether it is still needed (a camera feed keeps publishing, a voice panel
// that never joined should let it go).
const emit = defineEmits<{ (e: "closed"): void }>();

const settings = useAudioSettings();
const open = ref(false);

async function openSettings() {
  open.value = true;

  if (props.hubAware) {
    useRightSidebar().suspendHoverClose();
  }

  // Device labels only exist once a permission has been granted, so a surface
  // whose mic is not open yet still gets a real list rather than anonymous ids.
  void settings.refreshDevices();

  // Another channel is already publishing this microphone. Opening a second
  // capture of the same device to drive a meter is both wasteful and a good way
  // to fail on hardware that grants exclusive access -- the settings are shared,
  // so changing them here still reaches the live session.
  if (props.busyChannel) {
    return;
  }

  // Opens the mic so the meter and the mic check work before joining. Metering
  // is only switched on while this dialog is up: the level is the one thing
  // that costs continuous work.
  try {
    await props.pipeline.start();
  } catch (caught) {
    console.error("[voice] could not open the microphone", caught);
    return;
  }

  props.pipeline.setMetering(true);
}

function closeSettings(next: boolean) {
  open.value = next;

  if (next) {
    return;
  }

  props.pipeline.setMetering(false);

  if (props.pipeline.monitoring.value) {
    props.pipeline.toggleMonitor();
  }

  if (props.hubAware) {
    useRightSidebar().resumeHoverClose();
  }

  emit("closed");
}

// So a surface can make its whole row the target rather than just the gear --
// a 28px hit area next to a two-line label is the smallest thing on screen.
defineExpose({ open: openSettings });

// A dialog left open when the panel unmounts would leak its lock and pin the
// hub open forever.
onUnmounted(() => {
  if (!open.value) {
    return;
  }

  props.pipeline.setMetering(false);

  if (props.hubAware) {
    useRightSidebar().resumeHoverClose();
  }
});
</script>

<template>
  <FiveStackToolTip as-child :delay-duration="120" side="top" align="end">
    <template #trigger>
      <Button
        size="xs"
        variant="ghost"
        :class="[
          'h-7 w-7 rounded-full p-0 text-muted-foreground hover:text-foreground',
          props.class,
        ]"
        :aria-label="tooltip ?? $t('voice.settings.title')"
        @click="openSettings"
      >
        <Settings2 class="h-3.5 w-3.5" />
      </Button>
    </template>
    {{ tooltip ?? $t("voice.settings.title") }}
  </FiveStackToolTip>

  <VoiceSettingsDialog
    :open="open"
    :input-devices="settings.inputDevices.value"
    :output-devices="settings.outputDevices.value"
    :mic-device-id="settings.micDeviceId.value"
    :output-device-id="settings.outputDeviceId.value"
    :input-level="pipeline.inputLevel.value"
    :threshold="settings.threshold.value"
    :input-mode="settings.inputMode.value"
    :noise-suppression="settings.noiseSuppression.value"
    :transmitting="pipeline.transmitting.value"
    :monitoring="pipeline.monitoring.value"
    :live="pipeline.live.value"
    :unsupported="settings.unsupported.value"
    :busy-channel="busyChannel"
    @update:open="closeSettings"
    @update:mic="settings.setMicDevice"
    @update:output="settings.setOutputDevice"
    @update:mode="settings.setInputMode"
    @update:threshold="settings.setThreshold"
    @update:noise-suppression="settings.setNoiseSuppression"
    @toggle-monitor="pipeline.toggleMonitor"
    @test-output="settings.playTestTone"
  />
</template>
