<script lang="ts" setup>
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import PlayerPremierRank from "~/components/PlayerPremierRank.vue";
import PlayerFaceitRank from "~/components/PlayerFaceitRank.vue";
import EloChangeBadge from "~/components/EloChangeBadge.vue";
import { tierFor, RANK_TIERS, PROVISIONAL_TIER } from "~/utils/eloTier";
import { csRankIcon, csRankName } from "~/utilities/csRank";

// A player's rank for one match, in the system that match was played on:
// 5Stack ELO tier, Premier CS Rating, FACEIT level, or a Valve skill group.
// Same boxed pill as the profile's RANK / FACEIT / PREMIER chips, followed by
// the change (only the ▲/▼ carries color).
const props = defineProps<{
  kind: MatchRankKind;
  value: number;
  change?: number | null;
  faceitLevel?: number | null;
  // Full v_player_elo row for 5Stack matches — EloChangeBadge's breakdown.
  eloChange?: any | null;
}>();

const SKILL_RANK_TYPE = { competitive: 7, wingman: 6 } as const;

const tier = computed(() => tierFor(props.value));
const nextTier = computed(() => {
  if (tier.value === PROVISIONAL_TIER) return RANK_TIERS.at(-1) ?? null;
  return RANK_TIERS[RANK_TIERS.indexOf(tier.value) - 1] ?? null;
});

const isSkill = computed(
  () => props.kind === "competitive" || props.kind === "wingman",
);
const skillIcon = computed(() =>
  isSkill.value
    ? csRankIcon(
        SKILL_RANK_TYPE[props.kind as "competitive" | "wingman"],
        props.value,
      )
    : null,
);
const skillName = computed(() =>
  isSkill.value
    ? csRankName(
        SKILL_RANK_TYPE[props.kind as "competitive" | "wingman"],
        props.value,
      )
    : null,
);

const change = computed(() => Number(props.change ?? 0) || 0);

const pillClasses =
  "relative inline-flex items-center gap-1.5 select-none leading-none h-[26px] px-[0.6rem] rounded-md border bg-[hsl(var(--card)/0.55)] [backdrop-filter:blur(6px)]";
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <FiveStackToolTip v-if="kind === 'elo'" as-child>
      <template #trigger>
        <span
          :class="[pillClasses, 'border-[rgb(var(--tier-rgb)/0.4)]']"
          :style="{ '--tier-rgb': tier.rgb }"
        >
          <span
            class="h-[7px] w-[7px] rounded-[1px] bg-[rgb(var(--tier-rgb))] [box-shadow:0_0_8px_rgb(var(--tier-rgb)/0.7)]"
            aria-hidden="true"
          ></span>
          <span
            class="font-mono text-[0.75rem] font-bold tabular-nums tracking-[0.04em] text-[rgb(var(--tier-rgb))] [text-shadow:0_0_10px_rgb(var(--tier-rgb)/0.35)]"
          >
            {{ value.toLocaleString() }}
          </span>
        </span>
      </template>
      <div
        class="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em]"
        :style="{ color: `rgb(${tier.rgb})` }"
      >
        {{ tier.label }}
      </div>
      <div v-if="nextTier" class="mt-1 text-xs">
        {{
          $t("player_match.to_next", {
            points: (nextTier.threshold - value).toLocaleString(),
            tier: nextTier.label,
          })
        }}
      </div>
    </FiveStackToolTip>

    <PlayerPremierRank v-else-if="kind === 'premier'" :premier-rank="value" />

    <PlayerFaceitRank
      v-else-if="kind === 'faceit'"
      :faceit-skill-level="faceitLevel"
      :faceit-elo="value"
      show-elo
    />

    <FiveStackToolTip v-else-if="skillIcon" as-child>
      <template #trigger>
        <span :class="[pillClasses, 'border-border']">
          <img
            :src="skillIcon"
            :alt="skillName ?? ''"
            class="h-[18px] w-auto"
          />
        </span>
      </template>
      {{ skillName }}
    </FiveStackToolTip>

    <EloChangeBadge
      v-if="kind === 'elo' && eloChange"
      :elo-change="eloChange"
      size="sm"
      plain
    />
    <span
      v-else-if="change !== 0"
      class="inline-flex items-center gap-px font-mono text-[0.6rem] font-bold tabular-nums leading-none text-muted-foreground"
    >
      <span
        aria-hidden="true"
        :class="
          change > 0 ? 'text-[hsl(142_71%_60%)]' : 'text-[hsl(0_84%_66%)]'
        "
        >{{ change > 0 ? "▲" : "▼" }}</span
      >
      <template v-if="!isSkill">{{
        Math.abs(change).toLocaleString()
      }}</template>
    </span>
  </span>
</template>

<script lang="ts">
export type MatchRankKind =
  "elo" | "premier" | "faceit" | "competitive" | "wingman";

// The rank one match moved, as PlayerMatchRow hands it to the badge + strip.
export interface MatchRankMove {
  kind: MatchRankKind;
  value: number;
  change: number;
  faceitLevel?: number | null;
  eloChange?: any | null;
}
</script>
