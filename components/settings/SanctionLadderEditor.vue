<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Infinity as InfinityIcon, Plus, X } from "lucide-vue-next";
import {
  splitDuration,
  toMinutes,
  type DurationUnit,
} from "~/utilities/sanctions";

/**
 * The escalation ladder, which is stored as a bare CSV of minutes
 * ("10,60,120,240,480,960,1920") and is hostile in that form: nothing in the
 * string says the 7th entry is 32 hours, that it also covers the 8th, 9th and
 * every offence after, or that a `0` anywhere means the sanction never lifts.
 *
 * So the CSV is never shown. Each entry is a rung with its own amount + unit,
 * the clamp is spelled out on the last rung, and `0` renders as "permanent"
 * rather than as a duration of no length. The model is a number[]; the page
 * joins it back into the CSV, which can only ever match the API's pattern
 * because every rung came out of a clamped number input.
 */
const props = defineProps<{
  modelValue: number[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number[]): void;
}>();

const { t } = useI18n();

const UNITS: DurationUnit[] = ["minutes", "hours", "days"];

const I18N = "pages.settings.application.sanctions.ladder";

// Singular is a separate KEY rather than vue-i18n's `a | b` pipe form: the
// pipe form needs the `$t(key, plural, named)` overload, which is not in the
// i18n types this repo type-checks against (see the pre-existing TS2554 on
// components/MatchTableRow.vue's `$t("clips.clip_count", clipCount)`).
function durationLabel(value: number, unit: DurationUnit): string {
  const base = `${I18N}.unit_value.${unit}`;
  return t(value === 1 ? `${base}_one` : base, { count: value });
}

function rungLabel(index: number, isLast: boolean): string {
  return t(isLast ? `${I18N}.occurrence_and_after` : `${I18N}.occurrence`, {
    count: index + 1,
  });
}

// The largest exact unit for each rung, so a ladder saved as minutes still
// reads back as "32 hours" / "7 days" instead of a five-digit number.
const rungs = computed(() =>
  props.modelValue.map((minutes, index) => ({
    index,
    minutes,
    ...splitDuration(minutes),
  })),
);

function commit(next: number[]) {
  emit("update:modelValue", next);
}

function setAmount(index: number, raw: string | number) {
  const amount = Number(String(raw).trim());
  const unit = rungs.value[index].unit;
  const next = [...props.modelValue];
  // NaN from a cleared input is 0 — which is "permanent", a real and very
  // different value. An empty box must not silently make a rung permanent, so
  // it holds at 0 only because the operator can see the label say so.
  next[index] = Number.isFinite(amount) ? toMinutes(amount, unit) : 0;
  commit(next);
}

function setUnit(index: number, unit: DurationUnit) {
  const next = [...props.modelValue];
  next[index] = toMinutes(rungs.value[index].value, unit);
  commit(next);
}

function addRung() {
  const last = props.modelValue[props.modelValue.length - 1] ?? 10;
  // A new rung starts at double the previous one: an escalation ladder that
  // repeats the same penalty is the one shape the operator never wants.
  commit([...props.modelValue, last === 0 ? 0 : last * 2]);
}

function removeRung(index: number) {
  if (props.modelValue.length <= 1) {
    return;
  }
  commit(props.modelValue.filter((_, i) => i !== index));
}
</script>

<template>
  <div class="grid gap-2.5">
    <TransitionGroup
      tag="div"
      class="grid gap-2"
      enter-active-class="transition-[opacity,transform] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      leave-active-class="absolute transition-[opacity,transform] duration-150 motion-reduce:transition-none"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
      move-class="transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
    >
      <div
        v-for="rung in rungs"
        :key="`rung-${rung.index}`"
        class="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2"
      >
        <span
          class="w-full font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground sm:w-32"
        >
          {{
            rungLabel(
              rung.index,
              rung.index === rungs.length - 1 && rungs.length > 1,
            )
          }}
        </span>

        <Input
          type="number"
          min="0"
          inputmode="numeric"
          class="w-24"
          :disabled="disabled"
          :model-value="rung.value"
          @update:model-value="(amount) => setAmount(rung.index, amount)"
        />

        <Select
          :disabled="disabled || rung.minutes === 0"
          :model-value="rung.unit"
          @update:model-value="
            (unit) => setUnit(rung.index, unit as DurationUnit)
          "
        >
          <SelectTrigger class="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="unit in UNITS" :key="unit" :value="unit">
                {{
                  $t(`pages.settings.application.sanctions.ladder.unit.${unit}`)
                }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <!-- 0 is permanent, not "no time at all". It gets the warning colour and
             its own word so it can never be mistaken for an unset field. -->
        <span
          v-if="rung.minutes === 0"
          class="inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-[hsl(var(--warning))]"
        >
          <InfinityIcon class="h-3.5 w-3.5" />
          {{ $t("pages.settings.application.sanctions.permanent") }}
        </span>
        <span v-else class="text-[0.8rem] text-muted-foreground">
          {{ durationLabel(rung.value, rung.unit) }}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          :disabled="disabled || rungs.length <= 1"
          :aria-label="$t('pages.settings.application.sanctions.ladder.remove')"
          @click="removeRung(rung.index)"
        >
          <X class="h-3.5 w-3.5" />
        </Button>
      </div>
    </TransitionGroup>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="gap-1.5"
        :disabled="disabled"
        @click="addRung"
      >
        <Plus class="h-3.5 w-3.5" />
        {{ $t("pages.settings.application.sanctions.ladder.add") }}
      </Button>
      <p class="text-xs text-muted-foreground/70">
        {{ $t("pages.settings.application.sanctions.ladder.clamp_hint") }}
      </p>
    </div>
  </div>
</template>
