<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { Settings2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import VoiceSettingsDialog from "~/components/voice/VoiceSettingsDialog.vue";
import type { VoiceChat } from "~/composables/useVoiceChat";

// The gear plus everything behind it, so every surface that can join a voice
// channel -- the party hub, a match panel, a draft room -- offers the same
// device pickers, mic check and sensitivity rather than only the lobby.
const props = withDefaults(
  defineProps<{
    voice: VoiceChat;
    // The hub closes itself when the pointer leaves it, and the dialog is
    // portalled outside it, so reaching the dialog would close the panel out
    // from under it. Only the right hub needs this.
    hubAware?: boolean;
    class?: string;
  }>(),
  {
    hubAware: false,
    class: "",
  },
);

const open = ref(false);

async function openSettings() {
  open.value = true;

  if (props.hubAware) {
    useRightSidebar().suspendHoverClose();
  }

  // Another channel is already publishing this microphone. Opening a second
  // capture of the same device to drive a meter is both wasteful and a good way
  // to fail on hardware that grants exclusive access -- the settings are shared,
  // so changing them here still reaches the live session.
  if (props.voice.conflict.value) {
    return;
  }

  // Opens the mic so the meter and the mic check work before joining -- and
  // refreshes the device list, whose labels only exist once a permission has
  // been granted. Metering is only switched on while this dialog is up: the
  // level is the one thing that costs continuous work.
  await props.voice.startPreview();
  props.voice.setMetering(true);
}

function closeSettings(next: boolean) {
  open.value = next;

  if (next) {
    return;
  }

  props.voice.setMetering(false);

  if (props.hubAware) {
    useRightSidebar().resumeHoverClose();
  }

  props.voice.stopPreview();
}

// A dialog left open when the panel unmounts would leak its lock and pin the
// hub open forever.
onUnmounted(() => {
  if (!open.value) {
    return;
  }

  props.voice.setMetering(false);

  if (props.hubAware) {
    useRightSidebar().resumeHoverClose();
  }
});
</script>

<template>
  <Button
    size="xs"
    variant="ghost"
    :class="['h-7 w-7 rounded-full p-0 text-zinc-400 hover:text-zinc-100', props.class]"
    :aria-label="$t('voice.settings.title')"
    :title="$t('voice.settings.title')"
    @click="openSettings"
  >
    <Settings2 class="h-3.5 w-3.5" />
  </Button>

  <VoiceSettingsDialog
    :open="open"
    :input-devices="voice.inputDevices.value"
    :output-devices="voice.outputDevices.value"
    :mic-device-id="voice.micDeviceId.value"
    :output-device-id="voice.outputDeviceId.value"
    :input-level="voice.inputLevel.value"
    :threshold="voice.threshold.value"
    :input-mode="voice.inputMode.value"
    :noise-suppression="voice.noiseSuppression.value"
    :transmitting="voice.transmitting.value"
    :monitoring="voice.monitoring.value"
    :connected="voice.connected.value"
    :previewing="voice.previewing.value"
    :unsupported="voice.unsupported.value"
    :busy-channel="voice.conflict.value?.label ?? null"
    @update:open="closeSettings"
    @update:mic="voice.setMicDevice"
    @update:output="voice.setOutputDevice"
    @update:mode="voice.setInputMode"
    @update:threshold="voice.setThreshold"
    @update:noise-suppression="voice.setNoiseSuppression"
    @toggle-monitor="voice.toggleMonitor"
    @test-output="voice.playTestTone"
  />
</template>
