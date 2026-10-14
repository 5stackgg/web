<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import UtilityTechniqueIcon from "~/components/utility/UtilityTechniqueIcon.vue";
import UtilityThrowIcon from "~/components/utility/UtilityThrowIcon.vue";
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
  /** Drawn as the mouse rather than spelled out. */
  mouse?: boolean;
  /** Drawn as the side's own mark. */
  side?: boolean;
  /** Drawn as the technique's figure beside its name. */
  figure?: boolean;
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
      side: true,
    },
    {
      key: "technique",
      text: t(`pages.utility.techniques.${lineup.technique}`),
      tone: "plain",
      figure: true,
    },
    {
      // The throw is the one thing here you physically do, so it shows which
      // buttons to press rather than naming a strength you have to translate:
      // the mouse, with the full phrase as its label and title.
      key: "strength",
      text: t(
        `pages.utility.throw_buttons.${utilityThrowButtonsKey(lineup.throw_strength)}`,
      ),
      tone: "plain",
      hint: t(
        `pages.utility.throw_buttons.${utilityThrowButtonsKey(lineup.throw_strength)}`,
      ),
      mouse: true,
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
  warn: "border-[hsl(var(--tac-amber)/0.35)] text-[hsl(var(--tac-amber))]",
  bad: "border-destructive/40 text-destructive",
  unknown: "border-dashed text-muted-foreground/70",
};
</script>

<template>
  <!-- A chip per fact, one height: the side's mark, the technique's figure
       with its name, the mouse as the picture. Only a problem takes colour.
       Native titles rather than FiveStackToolTip: this renders a handful of
       times per card in a list of them. -->
  <p class="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
    <span
      v-for="segment of segments"
      :key="segment.key"
      :data-spec="segment.key"
      class="inline-flex h-[1.125rem] shrink-0 items-center gap-1 rounded-[5px] border border-white/[0.07] bg-white/[0.04] px-1.5 text-[0.7rem] leading-none"
      :class="TONES[segment.tone]"
      :title="segment.hint ?? segment.text"
    >
      <img
        v-if="segment.side"
        :src="
          lineup.side === 'CT'
            ? '/img/teams/ct_logo.svg'
            : '/img/teams/t_logo.svg'
        "
        :alt="segment.text"
        class="size-3.5"
      />
      <UtilityThrowIcon
        v-else-if="segment.mouse"
        :strength="lineup.throw_strength"
        :label="segment.text"
        class="block h-3.5 w-2.5 [&_[data-part=shell]]:stroke-muted-foreground [&_[data-part=shell]]:[stroke-width:1.5]"
      />
      <template v-else>
        <UtilityTechniqueIcon
          v-if="segment.figure"
          :technique="lineup.technique"
          class="size-3.5 text-foreground"
        />
        {{ segment.text }}
      </template>
    </span>
  </p>
</template>
