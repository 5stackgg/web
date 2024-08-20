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
  <form
    class="p-3 relative overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
    @submit.prevent="scheduleMatch"
  >
    <FormField v-slot="{ componentField }" name="scheduled_at">
      <FormItem>
        <FormLabel>Scheduled At</FormLabel>
        <FormControl>
          <div class="flex">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  class="w-[280px] justify-start text-left font-normal"
                  :class="{
                    ['text-muted-foreground']: !componentField.modelValue,
                  }"
                >
                  <CalendarIcon class="mr-2 h-4 w-4" />
                  {{ startDate || "Pick a date" }}
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
            ></Input>
          </div>

          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <div class="flex items-center p-3 pt-0">
      <Button class="-mr-2" :disabled="!hasMinimumLineupPlayers">
        Schedule Match
      </Button>
    </div>
  </form>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import * as z from "zod";
import { toTypedSchema } from "@vee-validate/zod";

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
          this.startDate = startDate.toDateString();
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
  computed: {
    hasMinimumLineupPlayers() {
      return (
        this.match.lineup_1?.lineup_players.length >=
          this.match.min_players_per_lineup &&
        this.match.lineup_2?.lineup_players.length >=
          this.match.min_players_per_lineup
      );
    },
  },
};
</script>
