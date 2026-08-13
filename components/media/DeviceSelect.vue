<script setup lang="ts">
import { computed } from "vue";
import type { FunctionalComponent } from "vue";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";

const props = defineProps<{
  icon: FunctionalComponent;
  devices: Array<MediaDeviceInfo>;
  modelValue: string;
  // Drives the small activity dot: 0..1 for a live input, or undefined for a
  // device with nothing to meter (an output, or a camera).
  level?: number;
  active?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", deviceId: string): void;
}>();

// Select treats "" as "nothing chosen" and would show a placeholder instead of
// a label, so the system default carries a value of its own.
const SYSTEM_DEFAULT = "__default__";

// Browsers repeat the active device as a synthetic "default" entry; listing
// both makes the picker look broken.
const options = computed(() =>
  props.devices.filter((device) => device.deviceId !== "default"),
);

const selected = computed(() =>
  options.value.find((device) => device.deviceId === props.modelValue),
);

const label = computed(() => {
  if (!props.modelValue) {
    return null;
  }
  // A remembered device that is currently unplugged is not in the list.
  return selected.value?.label || null;
});

const dotOpacity = computed(() => {
  if (props.level === undefined) {
    return 1;
  }
  return 0.25 + Math.min(1, props.level * 4) * 0.75;
});
</script>

<template>
  <Select
    :model-value="modelValue || SYSTEM_DEFAULT"
    :disabled="disabled"
    @update:model-value="
      (value) =>
        emit('update:modelValue', value === SYSTEM_DEFAULT ? '' : String(value))
    "
  >
    <SelectTrigger
      class="h-auto w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40"
    >
      <span class="flex min-w-0 items-center gap-3">
        <span
          class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors"
          :class="
            active
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
              : 'border-border bg-muted/40 text-muted-foreground'
          "
        >
          <component :is="icon" class="h-3.5 w-3.5" />
          <span
            v-if="active"
            class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 transition-opacity duration-75"
            :style="{ opacity: dotOpacity }"
          ></span>
        </span>

        <span class="flex min-w-0 flex-col text-left">
          <span class="truncate text-xs font-medium">
            {{ label ?? $t("media.device.system_default") }}
          </span>
          <span class="truncate text-[10px] text-muted-foreground">
            {{
              label
                ? $t("media.device.selected")
                : $t("media.device.following_system")
            }}
          </span>
        </span>
      </span>
    </SelectTrigger>

    <SelectContent>
      <SelectGroup>
        <SelectItem :value="SYSTEM_DEFAULT" class="py-2 text-xs">
          {{ $t("media.device.system_default") }}
        </SelectItem>
        <SelectItem
          v-for="(device, index) in options"
          :key="device.deviceId"
          :value="device.deviceId"
          class="py-2 text-xs"
        >
          {{ device.label || `${$t("media.device.device")} ${index + 1}` }}
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</template>
