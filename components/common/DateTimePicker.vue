<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-vue-next";
import {
  CalendarDateTime,
  fromDate,
  toCalendarDate,
  toZoned,
  getLocalTimeZone,
} from "@internationalized/date";

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    withTime?: boolean;
    minToday?: boolean;
    size?: "default" | "sm";
  }>(),
  { withTime: true, minToday: true, size: "default" },
);

const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

const startDate = ref<any>(undefined);
const startTime = ref<string | undefined>(undefined);

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      return;
    }
    const date = props.withTime
      ? new Date(value)
      : new Date(`${value}T00:00:00`);
    if (isNaN(date.getTime())) {
      return;
    }
    startDate.value = toCalendarDate(fromDate(date, getLocalTimeZone()));
    if (props.withTime) {
      startTime.value = `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
      ).padStart(2, "0")}`;
    }
  },
  { immediate: true },
);

function emitValue() {
  if (!startDate.value) {
    return;
  }
  if (props.withTime) {
    if (!startTime.value) {
      return;
    }
    const [hours, minutes] = startTime.value.split(":").map(Number);
    const cdt = new CalendarDateTime(
      startDate.value.year,
      startDate.value.month,
      startDate.value.day,
      hours,
      minutes,
    );
    emit(
      "update:modelValue",
      toZoned(cdt, getLocalTimeZone()).toAbsoluteString(),
    );
  } else {
    const month = String(startDate.value.month).padStart(2, "0");
    const day = String(startDate.value.day).padStart(2, "0");
    emit("update:modelValue", `${startDate.value.year}-${month}-${day}`);
  }
}

watch([startDate, startTime], emitValue);

const dateLabel = computed(() =>
  startDate.value
    ? `${startDate.value.month}/${startDate.value.day}/${startDate.value.year}`
    : "",
);

function checkDate({ day, month, year }: any) {
  if (!props.minToday) {
    return false;
  }
  return new Date(year, month - 1, day + 1) < new Date();
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Popover>
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :size="size"
          class="justify-start text-left font-normal"
          :class="{ 'text-muted-foreground': !startDate }"
        >
          <CalendarIcon class="mr-2 h-4 w-4" />
          {{ dateLabel || $t("common.pick_date") }}
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0">
        <Calendar
          :is-date-disabled="checkDate"
          v-model="startDate"
          initial-focus
        />
      </PopoverContent>
    </Popover>
    <Input
      v-if="withTime"
      type="time"
      v-model="startTime"
      style="color-scheme: dark"
      :class="size === 'sm' ? 'h-8 w-[110px] text-xs' : 'w-[120px]'"
    />
  </div>
</template>
