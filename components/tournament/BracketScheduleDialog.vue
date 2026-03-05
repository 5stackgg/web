<script lang="ts" setup>
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
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
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {{ $t("tournament.bracket.schedule_title") }}
          <span v-if="bracket" class="text-muted-foreground text-sm font-normal">
            — {{ $t("tournament.match.round_match_ref", { round: bracket.round, match: bracket.match_number }) }}
          </span>
        </DialogTitle>
      </DialogHeader>

      <div v-if="bracket" class="space-y-4">
        <div v-if="teamNames" class="text-sm text-muted-foreground">
          {{ teamNames }}
        </div>

        <div v-if="bracket.scheduled_at" class="text-sm text-green-400">
          {{ $t("tournament.bracket.currently_scheduled") }}:
          <TimeAgo :date="bracket.scheduled_at" />
        </div>

        <div class="flex items-center gap-2">
          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                class="flex-1 justify-start text-left font-normal"
                :class="{ 'text-muted-foreground': !startDate }"
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
            class="w-[120px]"
          />
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button
          v-if="bracket?.scheduled_at"
          variant="outline"
          @click="clearSchedule"
          :disabled="saving"
        >
          {{ $t("tournament.bracket.clear_schedule") }}
        </Button>
        <Button
          @click="saveSchedule"
          :disabled="!startDate || !startTime || saving"
        >
          {{ $t("tournament.bracket.save_schedule") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import TimeAgo from "~/components/TimeAgo.vue";
import { fromDate, toCalendarDate, CalendarDate, today, getLocalTimeZone } from "@internationalized/date";
import { toast } from "@/components/ui/toast";
import type { Bracket } from "~/types/tournament";

export default {
  props: {
    open: {
      type: Boolean,
      required: true,
    },
    bracket: {
      type: Object as () => Bracket | null,
      default: null,
    },
  },
  emits: ["update:open"],
  data() {
    return {
      startDate: undefined as CalendarDate | undefined,
      startTime: undefined as string | undefined,
      saving: false,
    };
  },
  computed: {
    teamNames(): string {
      if (!this.bracket) return "";
      const t1 =
        this.bracket.team_1?.team?.name || this.bracket.team_1?.name || "";
      const t2 =
        this.bracket.team_2?.team?.name || this.bracket.team_2?.name || "";
      if (t1 && t2) return `${t1} vs ${t2}`;
      if (t1) return t1;
      if (t2) return t2;
      return "";
    },
  },
  watch: {
    bracket: {
      immediate: true,
      handler(bracket) {
        if (bracket?.scheduled_at) {
          const date = new Date(bracket.scheduled_at);
          this.startDate = toCalendarDate(fromDate(date, Intl.DateTimeFormat().resolvedOptions().timeZone));
          this.startTime = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
        } else {
          this.startDate = undefined;
          this.startTime = undefined;
        }
      },
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
      return new CalendarDate(year, month, day).compare(today(getLocalTimeZone())) < 0;
    },
    async saveSchedule() {
      if (!this.bracket || !this.startDate || !this.startTime) return;
      const scheduled_at = new Date(`${this.startDate}T${this.startTime}`);
      if (scheduled_at <= new Date()) {
        toast({
          title: this.$t("tournament.bracket.past_time_error"),
          variant: "destructive",
        });
        return;
      }
      this.saving = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_tournament_brackets_by_pk: [
              {
                _set: { scheduled_at: scheduled_at.toISOString() },
                pk_columns: { id: this.bracket.id },
              },
              { id: true, scheduled_at: true },
            ],
          }),
        });
        this.$emit("update:open", false);
      } catch {
        toast({
          title: this.$t("error.generic"),
          variant: "destructive",
        });
      } finally {
        this.saving = false;
      }
    },
    async clearSchedule() {
      if (!this.bracket) return;
      this.saving = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_tournament_brackets_by_pk: [
              {
                _set: { scheduled_at: null },
                pk_columns: { id: this.bracket.id },
              },
              { id: true, scheduled_at: true },
            ],
          }),
        });
        this.$emit("update:open", false);
      } catch {
        toast({
          title: this.$t("error.generic"),
          variant: "destructive",
        });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
