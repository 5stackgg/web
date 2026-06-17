<script setup lang="ts">
import { useI18n } from "vue-i18n";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card, CardContent } from "~/components/ui/card";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  ExternalLink,
  ChevronsDown,
  ChevronDown,
  Minus,
  ChevronUp,
  ChevronsUp,
  Boxes,
  TriangleRight,
} from "lucide-vue-next";
import StatScale from "~/components/common/StatScale.vue";
import FormulaTokens from "~/components/common/FormulaTokens.vue";
import MeshAvailability from "~/components/common/MeshAvailability.vue";
import { LEGEND_VARS, tokenKey } from "~/utilities/statFormula";

const { t, te } = useI18n();

definePageMeta({ layout: false });

// Opened as a desktop popup (window.open from a match/player page) → stay
// chromeless. Loaded directly (shared link, mobile PWA) → wrap in the default
// layout so the nav is reachable instead of being a dead end.
const isPopout = import.meta.client && !!window.opener;

const GITHUB_URL = "https://github.com/5stackgg/5stack-panel/issues";

type Formula = { frac?: boolean; pct?: boolean; note?: boolean };

const FORMULAS: Record<string, Formula> = {
  accuracy: { frac: true, pct: true },
  accuracy_spotted: { frac: true, pct: true },
  rifle_accuracy: { frac: true, pct: true },
  pistol_accuracy: { frac: true, pct: true },
  sniper_accuracy: { frac: true, pct: true },
  head_accuracy: { frac: true, pct: true, note: true },
  hs_kill_pct: { frac: true, pct: true },
  first_bullet_accuracy: { frac: true, pct: true },
  spray_accuracy: { frac: true, pct: true },
  time_to_damage: { note: true },
  crosshair_placement: { note: true },
  counter_strafing: { frac: true, pct: true, note: true },
  tracking: { frac: true, pct: true },
  spotted_acc: { frac: true, pct: true },
  hltv: { note: true },
  kast: { frac: true, pct: true },
  adr: { frac: true },
  kd: { frac: true },
  kpr: { frac: true },
  dpr: { frac: true },
  mkr: {},
  survived_pct: { frac: true, pct: true },
  trade_kills: {},
  traded: { frac: true, pct: true },
  opening: { frac: true, pct: true },
  opening_attempts: { frac: true },
  flash_assists: {},
  flash_blind: { frac: true },
  util_efficiency: { frac: true },
  enemies_flashed_per: { frac: true },
  udr: { frac: true },
  trade_kill_pct: { frac: true, pct: true },
  he_damage: {},
  molotov_damage: {},
  he_team_damage: {},
  enemies_flashed: {},
  team_flashed: {},
  avg_flash_duration: { frac: true },
  unused_utility: {},
  wasted_magazine_pct: { frac: true, pct: true },
  elo: {},
  elo_change: { note: true },
  elo_impact: { note: true },
  buy_pistol: {},
  buy_eco: {},
  buy_force: {},
  buy_full: {},
  buy_win_rate: { frac: true, pct: true },
  man_advantage: { frac: true, pct: true },
  man_disadvantage: { frac: true, pct: true },
  clutch: {},
  clutch_won: {},
  clutch_saved: {},
  clutch_lost: {},
  clutch_win_rate: { frac: true, pct: true },
  clutch_against: {},
  kills_in_clutch: {},
  role_sniper: {},
  role_entry: {},
  role_support: {},
  role_rifler: {},
  awp_share: { frac: true, pct: true },
  entry_rate: { frac: true },
  support_idx: {},
  net_trade: {},
  trade_kill_opportunities: {},
  trade_kill_attempts: {},
  traded_death_opportunities: {},
  traded_death_attempts: {},
  traded_death_pct: { frac: true, pct: true },
  total_damage: {},
  team_damage: {},
  knife_kills: {},
  zeus_kills: {},
  multi_kill_breakdown: {},
  flashes_thrown: {},
  smokes_thrown: {},
  round_win_pct: { frac: true, pct: true },
  pistol_win_pct: { frac: true, pct: true },
  opening_win_pct: { frac: true, pct: true },
  team_trade_pct: { frac: true, pct: true },
  buy_matchup: {},
  h2h_kills: {},
  h2h_damage: {},
  h2h_flashes: {},
  h2h_weapon_class: {},
  weapon_usage_pct: { frac: true, pct: true },
  weapon_rating: { note: true },
  weapon_economy: { note: true },
  consistency: {},
};

const aimStats = [
  "accuracy",
  "accuracy_spotted",
  "rifle_accuracy",
  "pistol_accuracy",
  "sniper_accuracy",
  "head_accuracy",
  "hs_kill_pct",
  "first_bullet_accuracy",
  "spray_accuracy",
  "time_to_damage",
  "crosshair_placement",
  "counter_strafing",
  "tracking",
  "spotted_acc",
];

const impactStats = [
  "hltv",
  "consistency",
  "kast",
  "adr",
  "total_damage",
  "team_damage",
  "kd",
  "kpr",
  "dpr",
  "mkr",
  "multi_kill_breakdown",
  "survived_pct",
  "trade_kills",
  "trade_kill_pct",
  "net_trade",
  "trade_kill_opportunities",
  "trade_kill_attempts",
  "traded",
  "traded_death_pct",
  "traded_death_opportunities",
  "traded_death_attempts",
  "opening",
  "opening_attempts",
  "knife_kills",
  "zeus_kills",
];

const utilityStats = [
  "flash_assists",
  "flash_blind",
  "enemies_flashed",
  "team_flashed",
  "avg_flash_duration",
  "enemies_flashed_per",
  "flashes_thrown",
  "smokes_thrown",
  "util_efficiency",
  "udr",
  "he_damage",
  "molotov_damage",
  "he_team_damage",
  "unused_utility",
  "wasted_magazine_pct",
];

const eloStats = ["elo", "elo_change", "elo_impact"];

const economyStats = [
  "buy_pistol",
  "buy_eco",
  "buy_force",
  "buy_full",
  "buy_win_rate",
  "buy_matchup",
  "man_advantage",
  "man_disadvantage",
  "round_win_pct",
  "pistol_win_pct",
  "opening_win_pct",
  "team_trade_pct",
];

const headToHeadStats = [
  "h2h_kills",
  "h2h_damage",
  "h2h_flashes",
  "h2h_weapon_class",
];

const arsenalStats = ["weapon_usage_pct", "weapon_rating", "weapon_economy"];

const clutchStats = [
  "clutch",
  "clutch_against",
  "clutch_won",
  "clutch_saved",
  "clutch_lost",
  "clutch_win_rate",
  "kills_in_clutch",
];

const roleStats = [
  "role_sniper",
  "role_entry",
  "role_support",
  "role_rifler",
  "awp_share",
  "entry_rate",
  "support_idx",
];

const methodology = [
  "scores",
  "performance",
  "consistency",
  "focus",
  "geometry",
] as const;

function tip(k: string, field: string): string | null {
  const key = `match.lineup.stats.tooltips.${k}.${field}`;
  return te(key) ? t(key) : null;
}
function gloss(k: string, field: string): string | null {
  const key = `stat_glossary.${k}.${field}`;
  return te(key) ? t(key) : null;
}

function entry(k: string, aim: boolean) {
  return {
    key: k,
    title: aim
      ? (tip(k, "title") ?? gloss(k, "label") ?? k)
      : (gloss(k, "label") ?? k),
    description: aim
      ? (tip(k, "description") ?? gloss(k, "description") ?? "")
      : (gloss(k, "description") ?? ""),
    formula: FORMULAS[k] as Formula | undefined,
  };
}
function isFrac(f?: Formula): boolean {
  return !!f && !!f.frac;
}
</script>

<template>
  <NuxtLayout :name="isPopout ? false : 'default'">
    <PageTransition>
      <div
        class="text-foreground px-4 sm:px-6"
        :class="isPopout ? 'min-h-screen bg-background overflow-y-auto' : ''"
      >
        <div
          class="mx-auto w-full max-w-[62rem] flex flex-col gap-6 pt-6 pb-12"
        >
          <TacticalPageHeader>
            <template #title>{{ $t("glossary.title") }}</template>
          </TacticalPageHeader>

          <Card class="bg-card/20">
            <CardContent class="p-4 sm:p-6 flex flex-col gap-3">
              <p class="text-sm leading-relaxed text-foreground/90">
                {{ $t("glossary.intro") }}
              </p>
              <a
                :href="GITHUB_URL"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] font-mono text-[0.7rem] tracking-[0.14em] uppercase text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)]"
              >
                <ExternalLink class="w-3.5 h-3.5" />
                {{ $t("glossary.github_cta") }}
              </a>
            </CardContent>
          </Card>

          <Card class="bg-card/20">
            <CardContent class="p-5 sm:p-5 flex flex-col gap-3">
              <span
                class="font-mono text-[0.7rem] font-bold tracking-[0.16em] uppercase text-[hsl(var(--tac-amber))]"
              >
                {{ $t("glossary.legend.title") }}
              </span>
              <div
                class="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 text-sm"
              >
                <div
                  v-for="sym of LEGEND_VARS"
                  :key="sym"
                  class="flex items-baseline gap-2"
                >
                  <span
                    class="inline-flex items-center font-mono font-bold text-[hsl(var(--tac-amber))] min-w-[2.2rem]"
                  >
                    <TriangleRight
                      v-if="sym === 'θ'"
                      class="h-4 w-4"
                    /><template v-else>{{ sym }}</template>
                  </span>
                  <span class="text-muted-foreground">{{
                    $t(`glossary.var_help.${tokenKey(sym)}`)
                  }}</span>
                </div>
              </div>
              <p class="text-xs leading-snug text-muted-foreground/80">
                {{ $t("glossary.legend.note") }}
              </p>
              <div
                class="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground"
              >
                <span
                  class="font-mono uppercase tracking-[0.12em] text-[0.6rem]"
                  >{{ $t("glossary.scale_worse") }}</span
                >
                <ChevronsDown class="h-3.5 w-3.5 text-destructive" />
                <ChevronDown class="h-3.5 w-3.5 text-destructive/70" />
                <Minus class="h-3.5 w-3.5 text-muted-foreground" />
                <ChevronUp class="h-3.5 w-3.5 text-success/80" />
                <ChevronsUp class="h-3.5 w-3.5 text-success" />
                <span
                  class="font-mono uppercase tracking-[0.12em] text-[0.6rem]"
                  >{{ $t("glossary.scale_better") }}</span
                >
                <span class="text-muted-foreground/70">{{
                  $t("glossary.scale_legend")
                }}</span>
              </div>
              <div
                class="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground"
              >
                <Boxes class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
                <span>{{ $t("glossary.mesh_legend") }}</span>
              </div>
            </CardContent>
          </Card>

          <div class="grid gap-3 sm:grid-cols-2">
            <Card
              v-for="m of methodology"
              :key="m"
              class="bg-card/20"
              :class="m === 'scores' ? 'sm:col-span-2' : ''"
            >
              <CardContent class="p-5 sm:p-5 flex flex-col gap-2">
                <span
                  class="font-mono text-[0.7rem] font-bold tracking-[0.16em] uppercase text-[hsl(var(--tac-amber))]"
                >
                  {{ $t(`glossary.${m}.title`) }}
                </span>
                <p class="text-sm leading-relaxed text-foreground/85">
                  {{ $t(`glossary.${m}.body`) }}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card class="bg-card/20">
            <CardContent class="p-5 sm:p-5">
              <MeshAvailability />
            </CardContent>
          </Card>

          <template
            v-for="section of [
              { label: $t('glossary.sections.aim'), keys: aimStats, aim: true },
              {
                label: $t('glossary.sections.impact'),
                keys: impactStats,
                aim: false,
              },
              {
                label: $t('glossary.sections.utility'),
                keys: utilityStats,
                aim: false,
              },
              {
                label: $t('glossary.sections.economy'),
                keys: economyStats,
                aim: false,
              },
              {
                label: $t('glossary.sections.elo'),
                keys: eloStats,
                aim: false,
              },
              {
                label: $t('glossary.sections.clutches'),
                keys: clutchStats,
                aim: false,
              },
              {
                label: $t('glossary.sections.roles'),
                keys: roleStats,
                aim: false,
              },
              {
                label: $t('glossary.sections.head_to_head'),
                keys: headToHeadStats,
                aim: false,
              },
              {
                label: $t('glossary.sections.arsenal'),
                keys: arsenalStats,
                aim: false,
              },
            ]"
            :key="section.label"
          >
            <div class="flex flex-col gap-3">
              <span :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses" />
                {{ section.label }}
              </span>
              <Card class="bg-card/20">
                <CardContent class="p-2 sm:p-4 flex flex-col">
                  <div
                    v-for="(e, i) of section.keys.map((k) =>
                      entry(k, section.aim),
                    )"
                    :key="e.key"
                    class="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
                    :class="i > 0 ? 'border-t border-border/40' : ''"
                  >
                    <div class="flex flex-col gap-1 min-w-0">
                      <span class="font-semibold text-sm">{{ e.title }}</span>
                      <p class="text-xs leading-snug text-muted-foreground">
                        {{ e.description }}
                      </p>
                      <p
                        v-if="e.formula && e.formula.note"
                        class="text-[0.7rem] leading-snug text-muted-foreground/70"
                      >
                        {{ $t(`glossary.formulas.${e.key}.note`) }}
                      </p>
                      <StatScale :stat="e.key" class="mt-1.5 max-w-[22rem]" />
                    </div>

                    <div
                      v-if="e.formula"
                      class="justify-self-start sm:justify-self-end w-full sm:w-auto sm:max-w-[30rem] rounded border border-border/60 bg-background/50 px-3 py-2 font-mono text-[0.8rem] leading-relaxed text-foreground/90"
                    >
                      <span
                        v-if="isFrac(e.formula)"
                        class="inline-flex flex-wrap items-center gap-2"
                      >
                        <span class="text-muted-foreground/60">=</span>
                        <span
                          class="inline-flex flex-col items-center leading-none"
                        >
                          <span class="px-1 pb-2">
                            <FormulaTokens
                              :text="$t(`glossary.formulas.${e.key}.num`)"
                            />
                          </span>
                          <span class="h-px w-full bg-foreground/50"></span>
                          <span class="px-1 pt-1.5">
                            <FormulaTokens
                              :text="$t(`glossary.formulas.${e.key}.den`)"
                            />
                          </span>
                        </span>
                        <span v-if="e.formula.pct" class="text-muted-foreground"
                          >× 100</span
                        >
                      </span>

                      <span v-else>
                        <span class="text-muted-foreground/60">=&nbsp;</span
                        ><FormulaTokens
                          :text="$t(`glossary.formulas.${e.key}.expr`)"
                        />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </template>
        </div>
      </div>
    </PageTransition>
  </NuxtLayout>
</template>
