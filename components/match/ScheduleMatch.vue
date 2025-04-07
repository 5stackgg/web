<script lang="ts" setup>
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-vue-next";
</script>

<template>
  <form @submit.prevent="scheduleMatch">
    <FormField v-slot="{ componentField }" name="scheduled_at">
      <FormItem>
        <FormControl>
          <div class="flex items-center justify-between">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  class="w-[180px] justify-start text-left font-normal"
                  :class="{
                    'text-muted-foreground': !componentField.modelValue,
                  }"
                >
                  <CalendarIcon class="mr-2 h-4 w-4" />
                  {{ startDate || $t("match.schedule.pick_date") }}
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
              class="ml-2 w-[120px]"
            ></Input>

            <Button type="submit" class="ml-4">{{
              $t("match.schedule.schedule")
            }}</Button>
          </div>
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>
  </form>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import * as z from "zod";
import { toTypedSchema } from "@vee-validate/zod";
import { fromDate, toCalendarDate } from "@internationalized/date";

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
              .date()
              .refine((date) => date > new Date(), {
                message: "Date must be in the future",
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
          this.startDate = toCalendarDate(fromDate(startDate));
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
      this.form.setValues({
        scheduled_at: new Date(`${this.startDate} ${this.startTime}`),
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
  },
};
</script>
