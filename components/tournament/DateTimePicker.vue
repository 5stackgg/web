<script setup lang="ts">
import { Calendar as CalendarIcon } from "lucide-vue-next";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
</script>

<template>
  <div class="flex">
    <Popover>
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          class="w-[280px] justify-start text-left font-normal"
          :class="{ ['text-muted-foreground']: !startDate }"
        >
          <CalendarIcon class="mr-2 h-4 w-4" />
          {{ startDate || $t("common.pick_date") }}
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0">
        <Calendar
          :is-date-disabled="disablePastDates ? checkDate : undefined"
          v-model="startDate"
          initial-focus
        />
      </PopoverContent>
    </Popover>

    <Input type="time" v-model="startTime" style="color-scheme: dark" />
  </div>
</template>

<script lang="ts">
import { fromDate, toCalendarDate } from "@internationalized/date";

export default {
  props: {
    modelValue: {
      type: [Date, String],
      required: false,
      default: null,
    },
    // Create disables past days; editing an existing start must allow them.
    disablePastDates: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      startDate: undefined as any,
      startTime: undefined as string | undefined,
      // Set while syncing local state down from modelValue so the compose
      // watchers don't echo the same value back up and loop.
      internalUpdate: false,
    };
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(value) {
        if (!value) {
          return;
        }
        const date = new Date(value);
        const nextDate = toCalendarDate(
          fromDate(date, Intl.DateTimeFormat().resolvedOptions().timeZone),
        );
        const nextTime = `${date.getHours().toString().padStart(2, "0")}:${date
          .getMinutes()
          .toString()
          .padStart(2, "0")}`;

        if (
          String(this.startDate) !== String(nextDate) ||
          this.startTime !== nextTime
        ) {
          this.internalUpdate = true;
          this.startDate = nextDate;
          this.startTime = nextTime;
          this.$nextTick(() => {
            this.internalUpdate = false;
          });
        }
      },
    },
    startDate() {
      this.compose();
    },
    startTime() {
      this.compose();
    },
  },
  methods: {
    checkDate({
      day,
      month,
      year,
    }: {
      day: number;
      month: number;
      year: number;
    }) {
      return new Date(year, month - 1, day + 1) < new Date();
    },
    compose() {
      if (this.internalUpdate || !this.startDate || !this.startTime) {
        return;
      }
      // Space-separated date/time parsing is engine-dependent; the ISO
      // "T"-joined form is the only portable local-time format.
      this.$emit(
        "update:modelValue",
        new Date(`${this.startDate}T${this.startTime}`),
      );
    },
  },
};
</script>
