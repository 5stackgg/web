<script setup lang="ts">
import { computed } from "vue";
import {
  gameBanDay,
  kindOn,
  steamDateLabel,
  steamDaysAgo,
  vacBanDay,
  type BanEntry,
  type BanFilters,
  type BanKind,
} from "~/utilities/bans";

// One tag per ban the player carries: VAC and Game ban from Steam, Staff or
// Auto ban from 5Stack. In the ledger a tag the current filters leave out (an
// old Steam ban, an ended ban, a kind switched off) dims instead of hiding.
const props = defineProps<{
  entry: BanEntry;
  now: Date;
  filters?: BanFilters | null;
}>();

const on = (kind: BanKind) => !props.filters || kindOn(props.filters, kind);

const vacDay = computed(() => vacBanDay(props.entry));
const gameDay = computed(() => gameBanDay(props.entry));

const old = (day: string | null) =>
  !!props.filters &&
  !!day &&
  steamDaysAgo(day, props.now) > props.filters.windowDays;
const vacOld = computed(() => old(vacDay.value));
const gameOld = computed(() => old(gameDay.value));

// An old Steam ban says when it was: the year, or the day this year.
const when = (day: string) => {
  const year = Number(day.slice(0, 4));
  return year === props.now.getUTCFullYear()
    ? steamDateLabel(day, props.now)
    : String(year);
};
const vacWhen = computed(() => (vacOld.value ? when(vacDay.value!) : null));
// Without a day of its own the game ban shares the VAC tag's.
const gameWhen = computed(() =>
  gameOld.value && gameDay.value !== vacDay.value
    ? when(gameDay.value!)
    : null,
);

const fiveKind = computed(() => props.entry.sanction_kind);
const fiveOff = computed(() => {
  if (!props.entry.banned_here || !fiveKind.value) return true;
  if (!props.filters) return false;
  if (!on(fiveKind.value)) return true;
  const created = props.entry.sanction?.created_at;
  return (
    !!created &&
    props.now.getTime() - Date.parse(created) >
      props.filters.windowDays * 24 * 60 * 60 * 1000
  );
});

const tagBase =
  "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded border px-1.5 text-[0.7rem] font-semibold leading-none";
const offClasses = "border-border/70 bg-transparent text-muted-foreground/70";
</script>

<template>
  <span class="flex min-w-0 flex-wrap items-center gap-1">
    <span
      v-if="entry.vac_ban_count > 0"
      :class="[
        tagBase,
        vacOld || !on('vac')
          ? offClasses
          : 'border-destructive/40 bg-destructive/10 text-destructive',
      ]"
      :title="$t('pages.bans.tags.vac_title')"
    >
      {{
        entry.vac_ban_count > 1
          ? $t("pages.bans.tags.vac_count", { count: entry.vac_ban_count })
          : $t("pages.bans.tags.vac")
      }}
      <span v-if="vacWhen" class="font-medium">{{ vacWhen }}</span>
    </span>
    <span
      v-if="entry.game_ban_count > 0"
      :class="[
        tagBase,
        gameOld || !on('game')
          ? offClasses
          : 'border-orange-500/40 bg-orange-500/10 text-orange-400',
      ]"
      :title="$t('pages.bans.tags.game_title')"
    >
      {{
        entry.game_ban_count > 1
          ? $t("pages.bans.tags.game_count", { count: entry.game_ban_count })
          : $t("pages.bans.tags.game")
      }}
      <span v-if="gameWhen" class="font-medium">{{ gameWhen }}</span>
    </span>
    <span
      v-if="fiveKind"
      :class="[
        tagBase,
        fiveOff
          ? offClasses
          : 'border-border bg-foreground/[0.06] text-foreground',
      ]"
      :title="
        fiveKind === 'staff'
          ? $t('pages.bans.tags.staff_title')
          : $t('pages.bans.tags.auto_title')
      "
    >
      {{
        fiveKind === "staff"
          ? $t("pages.bans.tags.staff")
          : $t("pages.bans.tags.auto")
      }}
    </span>
  </span>
</template>
