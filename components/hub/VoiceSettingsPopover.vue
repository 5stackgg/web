<script setup lang="ts">
import { computed } from "vue";
import { Settings2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const props = defineProps<{
  inputDevices: Array<MediaDeviceInfo>;
  outputDevices: Array<MediaDeviceInfo>;
  micDeviceId: string;
  outputDeviceId: string;
  inputLevel: number;
  connected: boolean;
  unsupported: string | null;
}>();

const emit = defineEmits<{
  (e: "open"): void;
  (e: "update:mic", deviceId: string): void;
  (e: "update:output", deviceId: string): void;
}>();

// Select treats "" as no selection and would show the placeholder instead of a
// label, so the system default gets a real value of its own.
const SYSTEM_DEFAULT = "__default__";

const toValue = (deviceId: string) => deviceId || SYSTEM_DEFAULT;
const fromValue = (value: string) => (value === SYSTEM_DEFAULT ? "" : value);

// Browsers hand back a raw id until a permission exists, and macOS repeats the
// active device as a second "Default - ..." entry. Neither is worth showing.
const label = (device: MediaDeviceInfo, index: number) => {
  return device.label || `Device ${index + 1}`;
};

const inputs = computed(() =>
  props.inputDevices.filter((device) => device.deviceId !== "default"),
);
const outputs = computed(() =>
  props.outputDevices.filter((device) => device.deviceId !== "default"),
);

const levelPercent = computed(() =>
  Math.round(Math.min(1, Math.max(0, props.inputLevel)) * 100),
);
</script>

<template>
  <Popover @update:open="(open) => open && emit('open')">
    <PopoverTrigger as-child>
      <Button
        size="xs"
        variant="ghost"
        class="h-7 w-7 rounded-full p-0 text-zinc-400 hover:text-zinc-100"
        :aria-label="$t('layouts.lobby_panel.voice_settings')"
      >
        <Settings2 class="h-3.5 w-3.5" />
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-[19rem] space-y-4" align="end">
      <div class="flex items-center gap-2">
        <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
        <p
          class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("layouts.lobby_panel.voice_settings") }}
        </p>
      </div>

      <div class="space-y-1.5">
        <p class="text-[11px] font-medium">
          {{ $t("layouts.lobby_panel.microphone") }}
        </p>
        <Select
          :model-value="toValue(micDeviceId)"
          @update:model-value="(v) => emit('update:mic', fromValue(String(v)))"
        >
          <SelectTrigger class="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="SYSTEM_DEFAULT">
                {{ $t("layouts.lobby_panel.system_default") }}
              </SelectItem>
              <SelectItem
                v-for="(device, index) in inputs"
                :key="device.deviceId"
                :value="device.deviceId"
              >
                {{ label(device, index) }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div v-if="outputs.length" class="space-y-1.5">
        <p class="text-[11px] font-medium">
          {{ $t("layouts.lobby_panel.output") }}
        </p>
        <Select
          :model-value="toValue(outputDeviceId)"
          @update:model-value="
            (v) => emit('update:output', fromValue(String(v)))
          "
        >
          <SelectTrigger class="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="SYSTEM_DEFAULT">
                {{ $t("layouts.lobby_panel.system_default") }}
              </SelectItem>
              <SelectItem
                v-for="(device, index) in outputs"
                :key="device.deviceId"
                :value="device.deviceId"
              >
                {{ label(device, index) }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <!-- Answers "is my mic working" without needing a second person on the
           call. Only meaningful while something is actually being captured. -->
      <div v-if="connected" class="space-y-1.5">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-medium">
            {{ $t("layouts.lobby_panel.input_level") }}
          </p>
          <span class="font-mono text-[10px] tabular-nums text-muted-foreground">
            {{ levelPercent }}%
          </span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-[hsl(var(--tac-amber))] transition-[width] duration-75"
            :style="{ width: levelPercent + '%' }"
          ></div>
        </div>
      </div>

      <p
        v-if="unsupported"
        class="border-t pt-3 text-[11px] leading-relaxed text-destructive"
      >
        {{ $t(unsupported) }}
      </p>
    </PopoverContent>
  </Popover>
</template>
