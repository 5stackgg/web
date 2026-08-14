<script setup lang="ts">
import { Waves } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import VoiceSettingsPanel from "~/components/voice/VoiceSettingsPanel.vue";
import type { VoiceInputMode } from "~/composables/useVoiceChat";

defineProps<{
  open: boolean;
  inputDevices: Array<MediaDeviceInfo>;
  outputDevices: Array<MediaDeviceInfo>;
  micDeviceId: string;
  outputDeviceId: string;
  inputLevel: number;
  threshold: number;
  inputMode: VoiceInputMode;
  noiseSuppression: boolean;
  transmitting: boolean;
  monitoring: boolean;
  // The microphone this dialog is metering is open. Whether it is being sent
  // anywhere is the host surface's business, not this component's.
  live: boolean;
  unsupported: string | null;
  // Set when the microphone is live in a different channel. The settings still
  // apply -- they are shared -- but this dialog is not the one metering.
  busyChannel?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "update:mic", deviceId: string): void;
  (e: "update:output", deviceId: string): void;
  (e: "update:mode", mode: VoiceInputMode): void;
  (e: "update:threshold", value: number): void;
  (e: "update:noiseSuppression", enabled: boolean): void;
  (e: "toggleMonitor"): void;
  (e: "testOutput"): void;
}>();
</script>

<template>
  <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogContent data-right-hub-interactive class="sm:max-w-[30rem]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Waves class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          {{ $t("voice.settings.title") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("voice.settings.description") }}
          {{ $t("voice.settings.applies_everywhere") }}
        </DialogDescription>
      </DialogHeader>

      <VoiceSettingsPanel
        :input-devices="inputDevices"
        :output-devices="outputDevices"
        :mic-device-id="micDeviceId"
        :output-device-id="outputDeviceId"
        :input-level="inputLevel"
        :threshold="threshold"
        :input-mode="inputMode"
        :noise-suppression="noiseSuppression"
        :transmitting="transmitting"
        :monitoring="monitoring"
        :live="live"
        :error="unsupported"
        :busy-channel="busyChannel"
        @update:mic="(id) => emit('update:mic', id)"
        @update:output="(id) => emit('update:output', id)"
        @update:mode="(mode) => emit('update:mode', mode)"
        @update:threshold="(value) => emit('update:threshold', value)"
        @update:noise-suppression="
          (enabled) => emit('update:noiseSuppression', enabled)
        "
        @toggle-monitor="emit('toggleMonitor')"
        @test-output="emit('testOutput')"
      />
    </DialogContent>
  </Dialog>
</template>
