<script setup lang="ts">
import { computed } from "vue";
import {
  Headphones,
  Mic,
  MicOff,
  Play,
  Radio,
  Volume2,
  Waves,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import DeviceSelect from "~/components/media/DeviceSelect.vue";
import type { VoiceInputMode } from "~/composables/useVoiceChat";

const props = defineProps<{
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

// Only to decide whether this browser can choose an output at all.
const outputs = computed(() =>
  props.outputDevices.filter((device) => device.deviceId !== "default"),
);

const levelPercent = computed(() =>
  Math.round(Math.min(1, Math.max(0, props.inputLevel)) * 100),
);
const thresholdPercent = computed(() => Math.round(props.threshold * 100));

// Above the line the bar is the colour of what is actually being sent; below
// it, muted — so the threshold reads as a decision, not just a marker.
const live = computed(() => props.live);

const barClass = computed(() => {
  if (!live.value) {
    return "bg-zinc-600";
  }
  return props.transmitting
    ? "bg-emerald-400"
    : "bg-[hsl(var(--tac-amber))]/40";
});
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

      <p
        v-if="unsupported"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
      >
        {{ $t(unsupported) }}
      </p>

      <div class="space-y-6">
        <!-- Input device -->
        <section class="space-y-2">
          <div class="flex items-center gap-2">
            <Mic class="h-3.5 w-3.5 text-muted-foreground" />
            <h3
              class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("voice.settings.input") }}
            </h3>
          </div>

          <DeviceSelect
            :icon="Mic"
            :devices="inputDevices"
            :model-value="micDeviceId"
            :level="inputLevel"
            :active="live"
            @update:model-value="(id) => emit('update:mic', id)"
          />
        </section>

        <!-- Live check -->
        <section class="space-y-2.5">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Radio class="h-3.5 w-3.5 text-muted-foreground" />
              <h3
                class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ $t("voice.settings.mic_test") }}
              </h3>
            </div>
            <Button
              size="xs"
              :variant="monitoring ? 'secondary' : 'outline'"
              class="h-7 gap-1.5 text-[11px]"
              :disabled="!live"
              @click="emit('toggleMonitor')"
            >
              <component
                :is="monitoring ? Headphones : Play"
                class="h-3 w-3"
              />
              {{
                monitoring
                  ? $t("voice.settings.stop_listening")
                  : $t("voice.settings.listen")
              }}
            </Button>
          </div>

          <!-- Threshold sits on the meter, so raising it visibly starves the
               bar rather than being an abstract number. -->
          <div class="relative h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-[width] duration-75"
              :class="barClass"
              :style="{ width: levelPercent + '%' }"
            ></div>
            <div
              v-if="inputMode === 'voice'"
              class="absolute inset-y-0 w-[2px] bg-foreground/70"
              :style="{ left: thresholdPercent + '%' }"
            ></div>
          </div>

          <p class="text-[11px] leading-relaxed text-muted-foreground">
            {{
              live
                ? monitoring
                  ? $t("voice.settings.monitor_hint")
                  : $t("voice.settings.meter_hint")
                : busyChannel
                  ? $t("voice.settings.mic_in_use", { channel: busyChannel })
                  : $t("voice.settings.mic_starting")
            }}
          </p>
        </section>

        <!-- Input mode -->
        <section class="space-y-2">
          <h3
            class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("voice.settings.input_mode") }}
          </h3>

          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="mode in (['voice', 'open'] as const)"
              :key="mode"
              type="button"
              class="rounded-lg border px-3 py-2.5 text-left transition-colors"
              :class="
                inputMode === mode
                  ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]'
                  : 'hover:bg-muted/50'
              "
              @click="emit('update:mode', mode)"
            >
              <span class="block text-xs font-medium">
                {{ $t(`voice.settings.mode_${mode}`) }}
              </span>
              <span class="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                {{ $t(`voice.settings.mode_${mode}_hint`) }}
              </span>
            </button>
          </div>

          <div v-if="inputMode === 'voice'" class="space-y-1.5 pt-1">
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-muted-foreground">
                {{ $t("voice.settings.sensitivity") }}
              </span>
              <span
                class="font-mono text-[10px] tabular-nums text-muted-foreground"
              >
                {{ thresholdPercent }}%
              </span>
            </div>
            <Slider
              :model-value="[thresholdPercent]"
              :min="0"
              :max="60"
              :step="1"
              @update:model-value="
                (value) => emit('update:threshold', (value?.[0] ?? 0) / 100)
              "
            />
          </div>
        </section>

        <!-- Output -->
        <section class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Volume2 class="h-3.5 w-3.5 text-muted-foreground" />
              <h3
                class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ $t("voice.settings.output") }}
              </h3>
            </div>
            <Button
              size="xs"
              variant="outline"
              class="h-7 gap-1.5 text-[11px]"
              @click="emit('testOutput')"
            >
              <Play class="h-3 w-3" />
              {{ $t("voice.settings.test") }}
            </Button>
          </div>

          <DeviceSelect
            v-if="outputs.length"
            :icon="Volume2"
            :devices="outputDevices"
            :model-value="outputDeviceId"
            @update:model-value="(id) => emit('update:output', id)"
          />
          <p v-else class="text-[11px] text-muted-foreground">
            {{ $t("voice.settings.output_unsupported") }}
          </p>
        </section>

        <!-- Processing -->
        <section
          class="flex items-center justify-between gap-4 border-t pt-4"
          @click="emit('update:noiseSuppression', !noiseSuppression)"
        >
          <div class="cursor-pointer space-y-0.5">
            <p class="flex items-center gap-2 text-xs font-medium">
              <MicOff class="h-3.5 w-3.5 text-muted-foreground" />
              {{ $t("voice.settings.noise_suppression") }}
            </p>
            <p class="text-[10px] leading-snug text-muted-foreground">
              {{ $t("voice.settings.noise_suppression_hint") }}
            </p>
          </div>
          <Switch class="pointer-events-none" :model-value="noiseSuppression" />
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
