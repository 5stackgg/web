<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  UTILITY_AIM_DELTA_WARN_DEGREES,
  humanizeUtilityToken,
  utilityAimDelta,
  utilityDifficultyKey,
  utilityDifficultyMeasured,
  utilityThrowButtonsKey,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    lineup: UtilityLineup;
    // The card carries `recorded` as a tick beside the name, so the line only
    // ever speaks up about confidence when something is wrong with it.
    showConfidence?: boolean;
    // One line, truncated. Flight time and the difficulty grade are the two
    // segments worth losing first -- dropping them keeps the flags that matter
    // (a required keybind, low confidence) inside the visible width instead of
    // clipping the warning off the end.
    compact?: boolean;
    // The card's stat block carries flight time as a number; the line drops
    // it there rather than say it twice.
    showFlight?: boolean;
  }>(),
  { showConfidence: true, compact: false, showFlight: true },
);

const { t } = useI18n();

type Segment = {
  key: string;
  text: string;
  /** Plain facts read muted; only exceptions take a colour. */
  tone: "lead" | "plain" | "warn" | "bad" | "unknown";
  hint?: string;
};

const delta = computed(() => utilityAimDelta(props.lineup));

/**
 * One line of telemetry instead of six pills of identical weight. The rules it
 * enforces are the whole point of it: a fact is muted, an absence is dotted and
 * dimmer than a fact, and only a problem you have to act on takes colour.
 */
const segments = computed<Segment[]>(() => {
  const lineup = props.lineup;
  const out: Segment[] = [
    {
      key: "side",
      text: t(`pages.utility.sides.${lineup.side}`),
      tone: "lead",
    },
    {
      key: "technique",
      text: t(`pages.utility.techniques.${lineup.technique}`),
      tone: "plain",
    },
    {
      // The throw is the one thing here you physically do, so it says which
      // buttons to press rather than naming a strength you have to translate.
      // Abbreviated because this line already carries five other segments and
      // truncates in row mode; the full phrase is on the title.
      key: "strength",
      text: t(
        `pages.utility.throw_buttons.${utilityThrowButtonsKey(lineup.throw_strength)}_short`,
      ),
      tone: "plain",
      hint: t(
        `pages.utility.throw_buttons.${utilityThrowButtonsKey(lineup.throw_strength)}`,
      ),
    },
  ];

  const ms = Number(lineup.flight_time_ms ?? 0);
  if (ms > 0 && !props.compact && props.showFlight) {
    out.push({
      key: "flight",
      text: t("pages.utility.card.flight_time", {
        seconds: (ms / 1000).toFixed(1),
      }),
      tone: "plain",
      hint: t("pages.utility.card.flight_time_hint"),
    });
  }

  const difficulty = props.compact ? "" : String(lineup.difficulty ?? "").trim();
  if (difficulty) {
    const key = utilityDifficultyKey(difficulty);
    const label = key
      ? t(`pages.utility.difficulty.levels.${key}`)
      : humanizeUtilityToken(difficulty);
    // "Unmeasured" is the absence of a grade. Styling it like a grade is how
    // it ended up reading as a trait of the lineup rather than of the data.
    out.push({
      key: "difficulty",
      text: label,
      tone: utilityDifficultyMeasured(difficulty)
        ? key === "very_hard"
          ? "bad"
          : key === "hard"
            ? "warn"
            : "plain"
        : "unknown",
      hint: t(`pages.utility.difficulty.notes.${key ?? "unknown"}`),
    });
  }

  if (props.showConfidence) {
    const confidence = lineup.confidence;
    if (confidence === "low") {
      out.push({
        key: "confidence",
        text: t("pages.utility.confidence.low"),
        tone: "bad",
        hint: t("pages.utility.confidence.low_note"),
      });
    } else if (confidence === "derived") {
      const off =
        delta.value !== null && delta.value >= UTILITY_AIM_DELTA_WARN_DEGREES;
      out.push({
        key: "confidence",
        text: off
          ? t("pages.utility.confidence.derived_off")
          : t("pages.utility.confidence.derived"),
        tone: off ? "warn" : "plain",
        hint: off
          ? t("pages.utility.confidence.derived_off_note")
          : t("pages.utility.confidence.derived_note"),
      });
    }
  }

  return out;
});

const TONES: Record<Segment["tone"], string> = {
  lead: "text-foreground",
  plain: "text-muted-foreground",
  warn: "text-[hsl(var(--tac-amber))]",
  bad: "text-destructive",
  unknown: "text-muted-foreground/70 [border-bottom:1px_dotted_currentColor]",
};
</script>

<template>
  <p
    class="font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.1em] tabular-nums"
  >
    <!-- Native titles rather than FiveStackToolTip: this renders five times per
         card in a list of them, and a tooltip provider per segment is a lot of
         machinery to explain a word you can also just read. -->
    <template v-for="(segment, index) of segments" :key="segment.key">
      <span v-if="index > 0" aria-hidden="true" class="mx-1.5 text-border">
        /
      </span>
      <span
        :class="TONES[segment.tone]"
        class="whitespace-nowrap"
        :title="segment.hint"
      >
        {{ segment.text }}
      </span>
    </template>
  </p>
</template>
