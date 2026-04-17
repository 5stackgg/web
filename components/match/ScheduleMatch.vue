<script lang="ts" setup>
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { Calendar as CalendarIcon, X } from "lucide-vue-next";
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-col gap-1">
      <div class="flex justify-between items-center text-sm font-medium">
        <span>{{ $t("match.schedule.schedule") }}</span>
      </div>
      <p class="text-xs text-muted-foreground">
        <template v-if="!form.values.scheduled_at">
          Start the match now or schedule it for later.
        </template>
        <template v-else>
          Match scheduled for
          {{ scheduledLabel }}.
        </template>
      </p>
    </div>

    <form @submit.prevent="scheduleMatch">
      <FormField v-slot="{ componentField }" name="scheduled_at">
        <FormItem>
          <FormControl>
            <div class="space-y-3">
              <!-- Date and Time Inputs Row -->
              <div class="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      class="flex-1 justify-start text-left font-normal"
                      :class="{
                        'text-muted-foreground': !componentField.modelValue,
                      }"
                    >
                      <CalendarIcon class="mr-2 h-4 w-4" />
                      {{ startDate || $t("common.pick_date") }}
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
                  type="time"
                  v-model="startTime"
                  style="color-scheme: dark"
                  class="w-[120px]"
                ></Input>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  :disabled="!form.values.scheduled_at"
                  @click.prevent="resetSchedule"
                  :title="$t('match.schedule.reset')"
                >
                  <X class="h-4 w-4" />
                </Button>
              </div>

              <!-- Schedule Button Row -->
              <div class="flex items-center gap-2">
                <Button type="submit" size="sm" class="w-full">
                  <span v-if="!form.values.scheduled_at">
                    {{ $t("match.schedule.start_match") }}
                  </span>
                  <span v-else>
                    {{ $t("match.schedule.schedule") }}
                  </span>
                </Button>
              </div>
            </div>
            <FormMessage />
          </FormControl>
        </FormItem>
      </FormField>
    </form>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import * as z from "zod";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import {
  CalendarDateTime,
  fromDate,
  toCalendarDate,
  toZoned,
  getLocalTimeZone,
} from "@internationalized/date";

export default {
  props: {
    match: {
      required: true,
      type: Object,
    },
  },
  data() {
    return {
      startDate: undefined,
      startTime: undefined,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            scheduled_at: z
              .string()
              .refine((date) => new Date(date) > new Date(), {
                message: (this as any).$t("validation.date_must_be_future"),
              })
              .optional(),
          }),
        ),
      }),
    };
  },
  watch: {
    startTime: {
      immediate: true,
      handler() {
        this.setStart();
      },
    },
    startDate: {
      immediate: true,
      handler() {
        this.setStart();
      },
    },
    match: {
      immediate: true,
      handler(match) {
        if (match?.scheduled_at) {
          const startDate = new Date(match.scheduled_at);
          this.startDate = toCalendarDate(
            fromDate(startDate, getLocalTimeZone()),
          );
          this.startTime = `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`;
        }
      },
    },
  },
  methods: {
    checkDate({ day, month, year }) {
      return new Date(year, month - 1, day + 1) < new Date();
    },
    setStart() {
      if (!this.startDate || !this.startTime) {
        return;
      }
      const [hours, minutes] = this.startTime.split(":").map(Number);
      const cdt = new CalendarDateTime(
        this.startDate.year,
        this.startDate.month,
        this.startDate.day,
        hours,
        minutes,
      );
      this.form.setValues({
        scheduled_at: toZoned(cdt, getLocalTimeZone()).toAbsoluteString(),
      });
    },
    async scheduleMatch() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }
      await this.$apollo.mutate({
        mutation: generateMutation({
          scheduleMatch: [
            {
              match_id: this.match.id,
              time: this.form.values.scheduled_at,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
    async resetSchedule() {
      this.form.setValues({
        scheduled_at: undefined,
      });

      this.startDate = undefined;
      this.startTime = undefined;
    },
  },
  computed: {
    scheduledLabel() {
      const dateStr = this.form.values.scheduled_at as string | undefined;
      if (!dateStr) {
        return "";
      }
      return new Date(dateStr).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  },
};
</script>
