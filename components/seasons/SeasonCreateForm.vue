<script setup lang="ts">
import { CalendarIcon, Info, Plus, TriangleAlert, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { createButtonClasses } from "~/utilities/tacticalClasses";

const dateTriggerClasses =
  "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm tabular-nums shadow-sm transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
</script>

<template>
  <form class="grid max-w-[640px] gap-4" @submit.prevent="createSeason">
    <div
      v-if="blocker"
      class="flex items-start gap-2.5 rounded-lg border border-warning/35 bg-warning/[0.06] px-3.5 py-2.5 text-[0.8rem]"
    >
      <Info class="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
      <span>{{
        $t("pages.seasons.next.blocked", { season: seasonTitle(blocker) })
      }}</span>
    </div>

    <div class="grid gap-2">
      <Label for="season-desc">{{
        $t("pages.seasons.description_label")
      }}</Label>
      <Input
        id="season-desc"
        ref="descriptionInput"
        v-model="description"
        :placeholder="$t('pages.seasons.description_placeholder')"
      />
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="grid gap-2">
        <Label>{{ $t("pages.seasons.form.start_date") }}</Label>
        <Popover v-model:open="startOpen">
          <PopoverTrigger as-child>
            <button type="button" :class="dateTriggerClasses">
              <CalendarIcon
                class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              />
              <span :class="{ 'text-muted-foreground': !start }">{{
                start
                  ? formatCalendarDate(start)
                  : $t("pages.seasons.pick_date")
              }}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0">
            <Calendar
              :model-value="start"
              :is-date-disabled="startDisabled"
              initial-focus
              @update:model-value="onStart"
            />
          </PopoverContent>
        </Popover>
      </div>
      <div class="grid gap-2">
        <Label>{{ $t("pages.seasons.form.end_date") }}</Label>
        <div class="flex gap-2">
          <Popover v-model:open="endOpen">
            <PopoverTrigger as-child>
              <button type="button" :class="dateTriggerClasses">
                <CalendarIcon
                  class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                />
                <span :class="{ 'text-muted-foreground': !end }">{{
                  end ? formatCalendarDate(end) : $t("pages.seasons.ongoing")
                }}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="end"
                :is-date-disabled="endDisabled"
                initial-focus
                @update:model-value="onEnd"
              />
            </PopoverContent>
          </Popover>
          <Button
            v-if="end"
            type="button"
            variant="outline"
            size="icon"
            class="shrink-0"
            :aria-label="$t('common.clear')"
            @click="end = undefined"
          >
            <X />
          </Button>
        </div>
      </div>
    </div>

    <p class="text-xs text-muted-foreground">
      {{ $t("pages.seasons.utc_hint") }}
      <template v-if="!seasons.length && earliestMatchMs !== null">
        {{
          $t("pages.seasons.next.first_season_hint", {
            date: formatDate(new Date(earliestMatchMs).toISOString()),
          })
        }}
      </template>
    </p>

    <p
      v-if="error"
      class="flex items-start gap-2 text-[0.8rem] text-destructive"
    >
      <TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {{ error }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <Button
        type="submit"
        :class="createButtonClasses"
        :loading="creating"
        :disabled="!start"
      >
        <Plus />
        {{ $t("pages.seasons.create_button", { number: number }) }}
      </Button>
      <Button
        v-if="cancelable"
        type="button"
        variant="ghost"
        size="sm"
        @click="$emit('cancel')"
      >
        {{ $t("common.cancel") }}
      </Button>
    </div>
  </form>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { CalendarDate } from "@internationalized/date";
import { dateLocale } from "~/utilities/dateLocale";
import {
  openEndedBlocker,
  overlapsSeason,
  previewNumber,
  type SeasonRow,
} from "~/components/seasons/seasonPhase";

type DateValue = { year: number; month: number; day: number };

const toMs = (d: DateValue) => Date.UTC(d.year, d.month - 1, d.day);

function cdFromMs(value: number): CalendarDate {
  const d = new Date(value);
  return new CalendarDate(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
  );
}

export default {
  props: {
    seasons: { type: Array as () => SeasonRow[], required: true },
    now: { type: Number, required: true },
    cancelable: { type: Boolean, default: false },
  },
  emits: ["created", "cancel"],
  data() {
    return {
      description: "",
      start: undefined as CalendarDate | undefined,
      end: undefined as CalendarDate | undefined,
      startTouched: false,
      startOpen: false,
      endOpen: false,
      creating: false,
      error: "",
      earliestMatchMs: null as number | null,
    };
  },
  computed: {
    blocker(): SeasonRow | null {
      return openEndedBlocker(this.seasons, this.now);
    },
    number(): number {
      return previewNumber(this.seasons, this.start ? toMs(this.start) : null);
    },
  },
  watch: {
    seasons: {
      immediate: true,
      handler() {
        this.applyDefaultStart();
      },
    },
  },
  mounted() {
    void this.fetchEarliestMatch();
    const input = (this.$refs.descriptionInput as any)?.$el as
      HTMLInputElement | undefined;
    // The fold opens on the user's click; land the cursor in the form.
    if (this.cancelable) {
      setTimeout(() => input?.focus(), 240);
    }
  },
  methods: {
    seasonTitle(season: SeasonRow): string {
      return this.$t("pages.seasons.season_number", {
        number: season.number ?? "?",
      }) as string;
    },
    formatDate(iso: string): string {
      return new Date(iso).toLocaleDateString(dateLocale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    },
    formatCalendarDate(cd: CalendarDate): string {
      return this.formatDate(new Date(toMs(cd)).toISOString());
    },
    // First season defaults to the earliest match (covers history); later ones
    // start where the latest ended. Ongoing latest -> left empty.
    applyDefaultStart() {
      if (this.startTouched) {
        return;
      }
      if (this.seasons.length === 0) {
        if (this.earliestMatchMs) {
          this.start = cdFromMs(this.earliestMatchMs);
        }
        return;
      }
      const latest = [...this.seasons].sort(
        (a, b) =>
          new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
      )[0];
      this.start = latest?.ends_at
        ? cdFromMs(new Date(latest.ends_at).getTime())
        : undefined;
    },
    async fetchEarliestMatch() {
      try {
        const { data } = await (this as any).$apollo.query({
          query: typedGql("query")({
            matches: [
              {
                where: { ended_at: { _is_null: false } },
                order_by: [{ ended_at: order_by.asc }],
                limit: 1,
              },
              { ended_at: true },
            ],
          }),
          fetchPolicy: "no-cache",
        });
        const ended = data?.matches?.[0]?.ended_at;
        this.earliestMatchMs = ended ? new Date(ended).getTime() : null;
        this.applyDefaultStart();
      } catch {
        this.earliestMatchMs = null;
      }
    },
    // The DB exclusion constraint is the backstop; these just guide the pickers.
    startDisabled(dv: DateValue) {
      const value = toMs(dv);
      const endMs = this.end ? toMs(this.end) : value + 86_400_000;
      return overlapsSeason(this.seasons, value, endMs);
    },
    endDisabled(dv: DateValue) {
      if (!this.start) {
        return false;
      }
      const value = toMs(dv);
      const startMs = toMs(this.start);
      if (value <= startMs) {
        return true;
      }
      return overlapsSeason(this.seasons, startMs, value);
    },
    onStart(cd: CalendarDate | undefined) {
      this.start = cd;
      this.startTouched = true;
      this.startOpen = false;
      this.error = "";
    },
    onEnd(cd: CalendarDate | undefined) {
      this.end = cd;
      this.endOpen = false;
      this.error = "";
    },
    async createSeason() {
      this.error = "";
      if (!this.start || this.creating) {
        return;
      }

      let startMs = toMs(this.start);
      const endMs = this.end ? toMs(this.end) : Infinity;

      // The very first season must cover all history: clamp its start to (before)
      // the earliest recorded match so no past match is left off-season.
      if (!this.seasons.length && this.earliestMatchMs !== null) {
        const d = new Date(this.earliestMatchMs);
        const earliestMidnight = Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
        );
        if (startMs > earliestMidnight) {
          startMs = earliestMidnight;
        }
      }

      if (endMs <= startMs) {
        this.error = this.$t("pages.seasons.error_end_before_start");
        return;
      }
      if (overlapsSeason(this.seasons, startMs, endMs)) {
        this.error = this.$t("pages.seasons.error_overlap");
        return;
      }

      this.creating = true;
      try {
        const { data } = await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_seasons_one: [
              {
                object: {
                  description: this.description || null,
                  starts_at: new Date(startMs).toISOString(),
                  ends_at: this.end ? new Date(endMs).toISOString() : null,
                },
              },
              { id: true },
            ],
          }),
        });

        this.description = "";
        this.start = undefined;
        this.end = undefined;
        this.startTouched = false;

        toast({ title: this.$t("pages.seasons.created") });
        this.$emit("created", data?.insert_seasons_one?.id ?? null);
      } catch (error) {
        this.error =
          (error as Error)?.message || this.$t("pages.seasons.error_generic");
      } finally {
        this.creating = false;
      }
    },
  },
};
</script>
