import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useTableColumns, type ColumnDef } from "~/composables/useTableColumns";

// Optional columns the user can toggle per match-stats table. The lists are
// the "non-essential" stats — required identity columns (player name, the
// table's primary metric) are always rendered and not present here.
export function useOverviewColumns() {
  const { t } = useI18n();
  const columns = computed<ColumnDef[]>(() => [
    { key: "assists", label: t("common.stats.assists") },
    { key: "kd", label: t("match.overview.kd") },
    { key: "hltv", label: t("match.overview.hltv") },
    { key: "kast", label: t("match.overview.kast") },
    { key: "hs", label: t("match.overview.hs") },
    { key: "survived", label: t("match.overview.survived") },
    { key: "multikills", label: t("match.overview.multi_kill_rounds") },
    {
      key: "team_damage",
      label: t("match.overview.team_damage"),
      defaultVisible: false,
    },
    {
      key: "knife_kills",
      label: t("match.overview.knifes"),
      defaultVisible: false,
    },
    {
      key: "zeus_kills",
      label: t("match.overview.zeus"),
      defaultVisible: false,
    },
  ]);
  const state = useTableColumns("match-overview", columns.value);
  return { ...state, columnsRef: columns };
}

export function useUtilityColumns() {
  const { t } = useI18n();
  const columns = computed<ColumnDef[]>(() => [
    { key: "flash_assists", label: t("match.lineup.stats.flash_assists") },
    { key: "enemies_flashed", label: t("match.lineup.stats.enemies_flashed") },
    { key: "team_flashed", label: t("match.lineup.stats.team_flashed") },
    { key: "avg_blind_time", label: t("match.lineup.stats.avg_blind_time") },
    { key: "he_damage", label: t("match.lineup.stats.he_damage") },
    { key: "he_team_damage", label: t("match.lineup.stats.he_team_damage") },
    { key: "molotov_damage", label: t("match.lineup.stats.molotov_damage") },
    { key: "unused_utility", label: t("match.lineup.stats.unused_utility") },
    {
      key: "wasted_magazine_pct",
      label: t("match.lineup.stats.wasted_magazine_pct"),
    },
  ]);
  const state = useTableColumns("match-utility", columns.value);
  return { ...state, columnsRef: columns };
}

export function useAimColumns() {
  const { t } = useI18n();
  const columns = computed<ColumnDef[]>(() => [
    {
      key: "accuracy_spotted",
      label: t("match.lineup.stats.accuracy_spotted"),
    },
    { key: "rifle_accuracy", label: t("match.lineup.stats.rifle_accuracy") },
    {
      key: "pistol_accuracy",
      label: t("match.lineup.stats.pistol_accuracy"),
      defaultVisible: false,
    },
    {
      key: "sniper_accuracy",
      label: t("match.lineup.stats.sniper_accuracy"),
      defaultVisible: false,
    },
    { key: "head_accuracy", label: t("match.lineup.stats.head_accuracy") },
    { key: "hs_kill_pct", label: t("match.lineup.stats.hs_kill_pct") },
    { key: "spray_accuracy", label: t("match.lineup.stats.spray_accuracy") },
    { key: "time_to_damage", label: t("match.lineup.stats.time_to_damage") },
    { key: "spotted_acc", label: t("match.lineup.stats.spotted_acc") },
    {
      key: "crosshair_placement",
      label: t("match.lineup.stats.crosshair_placement"),
    },
    {
      key: "counter_strafing",
      label: t("match.lineup.stats.counter_strafing"),
    },
    {
      key: "first_bullet_accuracy",
      label: t("match.lineup.stats.first_bullet_accuracy"),
    },
    { key: "tracking", label: t("match.lineup.stats.tracking") },
  ]);
  const state = useTableColumns("match-aim", columns.value);
  return { ...state, columnsRef: columns };
}

export function useTradeColumns() {
  const { t } = useI18n();
  const columns = computed<ColumnDef[]>(() => [
    {
      key: "trade_kill_attempts",
      label: t("match.lineup.stats.trade_kill_attempts"),
    },
    { key: "trade_kill_pct", label: t("match.lineup.stats.trade_kill_pct") },
    {
      key: "traded_death_opportunities",
      label: t("match.lineup.stats.traded_death_opportunities"),
    },
    {
      key: "traded_death_attempts",
      label: t("match.lineup.stats.traded_death_attempts"),
    },
    {
      key: "traded_death_pct",
      label: t("match.lineup.stats.traded_death_pct"),
    },
    { key: "net_trade", label: t("match.lineup.stats.net_trade") },
  ]);
  const state = useTableColumns("match-trade", columns.value);
  return { ...state, columnsRef: columns };
}

export function useOpeningDuelsColumns() {
  const { t } = useI18n();
  const columns = computed<ColumnDef[]>(() => [
    { key: "traded", label: t("match.opening_duels.traded") },
    { key: "most_killed", label: t("match.opening_duels.most_killed") },
    { key: "best_weapon", label: t("match.opening_duels.best_weapon") },
    { key: "most_died_to", label: t("match.opening_duels.most_died_to") },
  ]);
  const state = useTableColumns("match-opening-duels", columns.value);
  return { ...state, columnsRef: columns };
}
