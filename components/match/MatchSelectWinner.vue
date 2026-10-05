<script lang="ts" setup>
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import { e_match_map_status_enum } from "~/generated/zeus";
import mapLabel from "~/utilities/mapLabel";
</script>

<template>
  <!-- Two teams, so two cards instead of a dropdown. Each card carries the
       team's result (the series map by map, or the one map being decided), so
       the pick is made against the score. The current winner is marked so the
       change being made is visible. -->
  <div
    class="grid grid-cols-2 gap-2"
    role="radiogroup"
    :aria-label="matchMap ? $t('match.map_winner.set') : $t('match.winner.set')"
  >
    <button
      v-for="team in teams"
      :key="team.id"
      type="button"
      role="radio"
      :aria-checked="picked === team.id"
      class="relative grid min-w-0 content-start gap-2.5 rounded-md border p-3 text-left transition-colors duration-200 ease-out"
      :class="
        picked === team.id
          ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)]'
          : 'border-border hover:bg-muted/40'
      "
      @click="pick(team.id)"
    >
      <span class="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-[0.65rem] font-extrabold tracking-wide text-foreground/85 ring-1 ring-inset ring-white/10"
        >
          <img
            v-if="team.crest"
            :src="team.crest"
            alt=""
            class="size-full object-cover"
          />
          <template v-else>{{ team.monogram }}</template>
        </span>
        <span class="grid min-w-0 gap-0.5">
          <span class="truncate text-sm font-semibold">{{ team.name }}</span>
          <span
            v-if="!matchMap && isSeries"
            class="truncate text-xs tabular-nums text-muted-foreground"
          >
            {{
              $t("match.winner.map_record", {
                won: team.won,
                lost: team.lost,
              })
            }}
          </span>
        </span>
      </span>

      <span v-if="matchMap" class="flex items-baseline gap-1.5 tabular-nums">
        <MatchLineupScoreDisplay
          :match="match"
          :lineup="team.lineup"
          :match-map="matchMap"
          :halves="false"
          class="text-2xl leading-none"
        />
        <MatchLineupScoreDisplay
          :match="match"
          :lineup="team.lineup"
          :match-map="matchMap"
          :score="false"
          class="text-muted-foreground"
        />
      </span>
      <span
        v-else-if="maps.length"
        class="grid gap-1 border-t border-border/60 pt-2 text-xs"
      >
        <span
          v-for="map in maps"
          :key="map.id"
          class="flex items-center justify-between gap-2"
        >
          <span class="truncate text-muted-foreground">
            {{ mapLabel(map.map) }}
          </span>
          <MatchLineupScoreDisplay
            v-if="map.status !== e_match_map_status_enum.Scheduled"
            :match="match"
            :lineup="team.lineup"
            :match-map="map"
            :halves="false"
            class="tabular-nums"
          />
          <span v-else class="text-muted-foreground/60">–</span>
        </span>
      </span>

      <span
        v-if="team.id === currentWinnerId"
        class="absolute -top-2 right-2 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[0.55rem] font-semibold uppercase leading-none tracking-[0.12em] text-muted-foreground"
      >
        {{ $t("match.admin_bar.current") }}
      </span>
    </button>
  </div>
</template>

<script lang="ts">
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { teamMonogram } from "~/components/watch/watchTicker";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    // Set to pick the winner of this one map instead of the match.
    matchMap: {
      type: Object,
      default: null,
    },
    // The lineup the parent already has in mind, e.g. from the menu row that
    // opened the dialog.
    selected: {
      type: String,
      default: null,
    },
  },
  // The parent's dialog sets the winner; this only reports the pick.
  emits: ["select"],
  data() {
    return {
      picked: null as string | null,
    };
  },
  watch: {
    // Only a real winner change resets the pick; the match object itself is
    // replaced on every live update.
    currentWinnerId: {
      immediate: true,
      handler(winningLineupId) {
        this.picked = this.selected ?? winningLineupId;
      },
    },
  },
  methods: {
    pick(value: string) {
      this.picked = value;
      const team = this.teams.find((team) => team.id === value);
      this.$emit("select", { value, label: team?.name ?? value });
    },
  },
  computed: {
    currentWinnerId() {
      return (this.matchMap ?? this.match).winning_lineup_id ?? null;
    },
    maps() {
      return this.match.match_maps ?? [];
    },
    isSeries() {
      return (this.match.options?.best_of ?? 1) > 1;
    },
    teams() {
      const apiDomain = useRuntimeConfig().public.apiDomain as string;
      // A pickup game's lineups are named after their captains, so the
      // captain's face stands in for the missing team crest.
      const isPug = !this.match.lineup_1.team_id && !this.match.lineup_2.team_id;

      return [this.match.lineup_1, this.match.lineup_2].map((lineup) => {
        const captain = lineup.lineup_players?.find(
          (member) => member.captain,
        )?.player;
        const decided = this.maps.filter((map) => map.winning_lineup_id);
        const won = decided.filter(
          (map) => map.winning_lineup_id === lineup.id,
        ).length;

        return {
          id: lineup.id,
          name: lineup.name,
          lineup,
          crest:
            resolveAvatarUrl(lineup.team?.avatar_url, apiDomain) ??
            (isPug
              ? resolveAvatarUrl(
                  captain?.custom_avatar_url || captain?.avatar_url,
                  apiDomain,
                )
              : null),
          monogram: teamMonogram(lineup.name ?? ""),
          won,
          lost: decided.length - won,
        };
      });
    },
  },
};
</script>
