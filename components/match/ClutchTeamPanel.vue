<script lang="ts" setup>
import { computed } from "vue";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import AnimatedStat from "~/components/AnimatedStat.vue";

const apiDomain = useRuntimeConfig().public.apiDomain;

function memberAvatarSrc(member: any, override: string | null | undefined) {
  if (override) return resolveAvatarUrl(override, apiDomain);
  const url =
    member?.player?.roster_image_url ||
    member?.player?.custom_avatar_url ||
    member?.player?.avatar_url;
  return resolveAvatarUrl(url, apiDomain);
}

function memberName(member: any): string {
  return member?.player?.name ?? member?.placeholder_name ?? "?";
}

type ClutchOutcome = "won" | "lost" | "saved";

type Clutch = {
  outcome: ClutchOutcome;
  round: number;
  match_map_id: string;
  clutcher_steam_id: string;
  against_count: number;
  kills_in_clutch: number;
};

const props = defineProps<{
  lineup: any;
  clutches: Clutch[];
  avatarOverride: (steamId: string | number) => string | null;
}>();

const totals = computed(() => {
  const won = props.clutches.filter((c) => c.outcome === "won").length;
  const lost = props.clutches.filter((c) => c.outcome === "lost").length;
  const saved = props.clutches.filter((c) => c.outcome === "saved").length;
  const total = won + lost + saved;
  const winPct = total > 0 ? Math.round((won / total) * 100) : 0;
  const lostPct = total > 0 ? Math.round((lost / total) * 100) : 0;
  const totalKills = props.clutches.reduce(
    (sum, c) => sum + c.kills_in_clutch,
    0,
  );
  return { won, lost, saved, total, winPct, lostPct, totalKills };
});

const playerColumns = computed(() => {
  return props.lineup.lineup_players.map((member: any) => {
    const steamId = String(member.steam_id);
    const playerClutches = props.clutches
      .filter((c) => c.clutcher_steam_id === steamId)
      .sort((a, b) => a.round - b.round);
    return { member, clutches: playerClutches };
  });
});

const outcomeClass = (outcome: ClutchOutcome) => {
  switch (outcome) {
    case "won":
      return "border-[hsl(var(--success)/0.7)] bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))]";
    case "lost":
      return "border-[hsl(var(--destructive)/0.7)] bg-[hsl(var(--destructive)/0.08)] text-destructive";
    case "saved":
      return "border-[hsl(var(--tac-amber)/0.7)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]";
  }
};
</script>

<template>
  <section
    class="relative border border-border bg-[hsl(var(--card)/0.2)]"
  >
    <header class="px-4 py-3 border-b border-border">
      <div
        class="flex items-center justify-between gap-3 mb-2 font-mono text-[0.65rem] tracking-[0.22em] uppercase text-muted-foreground"
      >
        <span class="truncate text-foreground/90">{{ lineup.name }}</span>
        <span class="shrink-0">
          <AnimatedStat :value="totals.won" /> /
          <AnimatedStat :value="totals.total" />
          {{ $t("match.clutches.clutches_won") }}
        </span>
      </div>

      <div
        class="flex items-center gap-2 font-mono text-[0.75rem] font-bold tabular-nums"
      >
        <span class="text-[hsl(var(--success))] w-[2.5rem] text-left">
          <AnimatedStat :value="totals.winPct + '%'" />
        </span>
        <div
          class="flex-1 h-[6px] border border-border bg-muted/40 overflow-hidden flex"
        >
          <div
            class="bg-[hsl(var(--success))] h-full"
            :style="{ width: totals.winPct + '%' }"
          />
          <div
            class="bg-[hsl(var(--destructive))] h-full"
            :style="{ width: totals.lostPct + '%' }"
          />
        </div>
        <span class="text-destructive w-[2.5rem] text-right">
          <AnimatedStat :value="totals.lostPct + '%'" />
        </span>
      </div>

      <div
        class="mt-2 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.18em] uppercase text-muted-foreground"
      >
        <span>
          <span class="text-[hsl(var(--success))] font-bold"
            ><AnimatedStat :value="totals.won"
          /></span>
          {{ $t("match.clutches.won") }}
        </span>
        <span>
          <span class="text-destructive font-bold"
            ><AnimatedStat :value="totals.lost"
          /></span>
          {{ $t("match.clutches.lost") }}
        </span>
        <span>
          <span class="text-[hsl(var(--tac-amber))] font-bold"
            ><AnimatedStat :value="totals.saved"
          /></span>
          {{ $t("match.clutches.saves") }}
        </span>
        <span class="ml-auto">
          {{ $t("match.clutches.total_kills") }}:
          <span class="text-foreground font-bold"
            ><AnimatedStat :value="totals.totalKills"
          /></span>
        </span>
      </div>
    </header>

    <div v-if="totals.total === 0" class="p-6 text-center">
      <p
        class="font-mono text-[0.7rem] tracking-[0.2em] uppercase text-muted-foreground"
      >
        {{ $t("match.clutches.no_attempts") }}
      </p>
    </div>

    <div
      v-else
      class="grid p-3 gap-3"
      :style="{
        gridTemplateColumns: `repeat(${playerColumns.length}, minmax(0, 1fr))`,
      }"
    >
      <div
        v-for="col of playerColumns"
        :key="col.member.steam_id"
        class="flex flex-col gap-2 min-w-0"
      >
        <div
          class="flex flex-col items-center gap-1 pb-2 border-b border-border/40 text-center min-w-0"
        >
          <img
            v-if="
              memberAvatarSrc(col.member, avatarOverride(col.member.steam_id))
            "
            :src="
              memberAvatarSrc(col.member, avatarOverride(col.member.steam_id))!
            "
            :alt="memberName(col.member)"
            class="w-8 h-8 rounded-full object-cover"
          />
          <span
            class="font-mono text-[0.65rem] tracking-[0.04em] text-foreground/90 leading-tight break-words text-center w-full"
            :title="memberName(col.member)"
          >
            {{ memberName(col.member) }}
          </span>
        </div>

        <div v-if="col.clutches.length === 0" class="flex justify-center pt-1">
          <span
            class="font-mono text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground/50"
          >
            —
          </span>
        </div>

        <div
          v-for="clutch of col.clutches"
          :key="clutch.match_map_id + '-' + clutch.round"
          :class="[
            'border-2 rounded-sm px-1.5 py-1.5 flex flex-col items-center gap-0.5',
            outcomeClass(clutch.outcome),
          ]"
        >
          <span
            class="font-mono text-[0.78rem] font-extrabold tabular-nums leading-none"
          >
            {{ $t("match.clutches.vs_short", { count: clutch.against_count }) }}
          </span>
          <span
            class="font-mono text-[0.62rem] tracking-[0.06em] tabular-nums leading-none"
          >
            ☠ {{ clutch.kills_in_clutch }}
          </span>
          <span
            class="font-mono text-[0.58rem] tracking-[0.14em] uppercase leading-none text-muted-foreground"
          >
            R{{ clutch.round }}
          </span>
          <span
            class="font-mono text-[0.58rem] font-bold tracking-[0.18em] uppercase leading-none mt-0.5"
          >
            {{
              clutch.outcome === "won"
                ? $t("match.clutches.won")
                : clutch.outcome === "lost"
                  ? $t("match.clutches.lost")
                  : $t("match.clutches.saved")
            }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
