<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { NuxtLink } from "#components";
import { ArrowRight } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  eliminationStandings,
  type PlaceRange,
  type StandingsGame,
} from "~/utilities/eliminationStandings";
import { getRoundLabel } from "~/utilities/tournamentRoundLabels";
import { ordinal } from "~/utilities/tournamentPlayerRank";

// Standings for a single or double elimination stage: the teams still in, as
// the matches they're playing, then everyone knocked out under the finish the
// bracket gave them. Nobody gets a place before the bracket decides it.
const props = defineProps<{
  stage: any;
  title: string;
  isFinalStage: boolean;
}>();

const { t } = useI18n();
const route = useRoute();

const MAX_GAMES = 6;

const divisions = computed(() => Number(props.stage.groups) || 1);

const groups = computed(() => {
  const brackets = props.stage.brackets || [];
  const out = [];
  for (let division = 1; division <= divisions.value; division++) {
    // A lower bracket's group is its division + groups.
    const own = brackets.filter((bracket: any) => {
      const group = bracket.group || 1;
      return group === division || group === division + divisions.value;
    });
    if (!own.length) continue;
    const standings = eliminationStandings(own);
    out.push({
      division,
      display:
        divisions.value <= 26
          ? String.fromCharCode(64 + division)
          : String(division),
      standings,
      games: standings.games.slice(0, MAX_GAMES),
      moreGames: Math.max(standings.games.length - MAX_GAMES, 0),
    });
  }
  return out;
});

const summary = computed(() => {
  if (groups.value.length !== 1) return null;
  const { standings } = groups.value[0];
  if (!standings.remaining) return null;
  const first = standings.games[0];
  return {
    round: first ? roundLabel(first.bracket) : null,
    left: t("tournament.standings.teams_left", {
      left: standings.remaining,
      total: standings.total,
    }),
  };
});

const bracketTab = computed(() => ({
  path: route.path,
  query: { ...route.query, tab: "bracket" },
}));

function roundLabel(bracket: any) {
  const group = bracket.group || 1;
  const siblings = (props.stage.brackets || []).filter(
    (other: any) => (other.group || 1) === group,
  );
  const label = getRoundLabel(
    bracket.round,
    props.stage.order,
    props.isFinalStage,
    siblings.filter((other: any) => other.round === bracket.round).length,
    bracket.path === "LB",
    props.stage.type,
    bracket.round === Math.max(...siblings.map((other: any) => other.round)),
  );
  return t(label.key, label.params ?? {});
}

function placeLabel(place: PlaceRange) {
  return place.from === place.to
    ? ordinal(place.from)
    : `${ordinal(place.from)}–${ordinal(place.to)}`;
}

function gameLabel(game: StandingsGame) {
  // The third-place match shares the final's round.
  if (game.winnerPlace && game.winnerPlace.from > 1) {
    return t("tournament.match.third_place_decider");
  }
  return roundLabel(game.bracket);
}

function gameStart(game: StandingsGame) {
  const bracket = game.bracket;
  return (
    bracket.scheduled_at ||
    bracket.match?.scheduled_at ||
    bracket.scheduled_eta ||
    null
  );
}

function stakes(game: StandingsGame) {
  const parts: Array<{ text: string; out?: boolean }> = [];
  if (game.winnerTo) {
    parts.push({
      text: t("tournament.standings.winner_to", {
        round: roundLabel(game.winnerTo),
      }),
    });
  } else if (game.winnerPlace) {
    parts.push({
      text: props.isFinalStage
        ? t("tournament.standings.for_place", {
            place: placeLabel(game.winnerPlace),
          })
        : t("tournament.standings.winner_advances"),
    });
  }
  if (game.loserTo) {
    parts.push({
      text: t("tournament.standings.loser_to", {
        round: roundLabel(game.loserTo),
      }),
    });
  } else if (game.loserPlace && game.winnerTo) {
    parts.push({
      text: t("tournament.standings.loser_out", {
        place: placeLabel(game.loserPlace),
      }),
      out: true,
    });
  }
  return parts;
}

// Medals only once the stage that hands them out is over.
function medalColor(place: PlaceRange, finished: boolean) {
  if (!finished || !props.isFinalStage) return undefined;
  if (place.from === 1) return "hsl(45 95% 60%)";
  if (place.from === 2) return "hsl(0 0% 78%)";
  if (place.from === 3) return "hsl(28 70% 52%)";
  return undefined;
}

const labelClasses =
  "mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground";
const seedClasses =
  "inline-grid h-[1.125rem] min-w-[1.25rem] shrink-0 place-items-center rounded-[3px] bg-muted/70 px-1 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground";
const tableColumns = "sm:grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1.15fr)]";
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between gap-3">
        <CardTitle>{{ title }}</CardTitle>
        <span
          v-if="summary"
          class="text-[0.8125rem] tabular-nums text-muted-foreground"
        >
          <template v-if="summary.round">{{ summary.round }} · </template>
          {{ summary.left }}
        </span>
      </div>
    </CardHeader>
    <CardContent class="grid gap-8">
      <div v-for="group in groups" :key="group.division" class="grid gap-6">
        <h4
          v-if="divisions > 1"
          class="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("tournament.stage.group", { group: group.display }) }}
        </h4>

        <section v-if="group.games.length">
          <h5 :class="labelClasses">
            {{ $t("tournament.standings.still_in") }}
          </h5>
          <div class="grid gap-3 sm:grid-cols-2">
            <component
              :is="game.bracket.match ? NuxtLink : 'div'"
              v-for="game in group.games"
              :key="game.bracket.id"
              :to="
                game.bracket.match
                  ? `/matches/${game.bracket.match.id}`
                  : undefined
              "
              class="block overflow-hidden rounded-md border bg-[hsl(240_6%_8%)] transition-colors duration-150"
              :class="
                game.live
                  ? 'border-emerald-500/70 shadow-[0_0_0_1px_rgb(16_185_129/0.25)]'
                  : 'border-border [@media(hover:hover)]:hover:border-foreground/35'
              "
            >
              <div
                class="flex h-[1.875rem] items-center justify-between gap-2 bg-muted/35 px-2.5 text-[0.78rem] font-semibold text-foreground/80"
              >
                <span class="min-w-0 truncate">{{ gameLabel(game) }}</span>
                <span
                  v-if="game.live"
                  class="inline-flex shrink-0 items-center gap-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-emerald-400"
                >
                  <span class="relative flex h-1.5 w-1.5">
                    <span
                      class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none"
                    ></span>
                    <span
                      class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
                    ></span>
                  </span>
                  {{ $t("common.live") }}
                </span>
                <TimeAgo
                  v-else-if="gameStart(game)"
                  :date="gameStart(game)"
                  hide-icon
                  class="shrink-0 font-medium text-muted-foreground"
                />
              </div>
              <div
                v-for="(slot, index) in game.slots"
                :key="index"
                class="grid h-9 grid-cols-[1.75rem_minmax(0,1fr)_auto_2.5rem] items-center pl-2.5 text-sm font-semibold"
                :class="index === 1 && 'border-t border-border/60'"
              >
                <span v-if="slot.team?.seed" :class="seedClasses">
                  {{ slot.team.seed }}
                </span>
                <span v-else></span>
                <span
                  class="min-w-0 truncate"
                  :class="
                    !slot.team && 'text-xs font-medium text-muted-foreground'
                  "
                >
                  {{ slot.team?.name || $t("common.tbd") }}
                </span>
                <span
                  class="pr-3 text-xs font-medium tabular-nums text-muted-foreground"
                >
                  <template v-if="slot.team">
                    {{ slot.team.wins }}–{{ slot.team.losses }}
                  </template>
                </span>
                <span
                  class="grid self-stretch place-items-center bg-muted/35 font-extrabold tabular-nums"
                >
                  {{ slot.score ?? "" }}
                </span>
              </div>
              <p
                v-if="stakes(game).length"
                class="m-0 border-t border-border/60 px-2.5 py-2 text-[0.78rem] text-muted-foreground"
              >
                <template v-for="(part, index) in stakes(game)" :key="index">
                  <template v-if="index"> · </template>
                  <span :class="part.out && 'font-semibold text-red-400'">{{
                    part.text
                  }}</span>
                </template>
              </p>
            </component>
          </div>
          <NuxtLink
            v-if="group.moreGames"
            :to="bracketTab"
            class="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {{
              $t("tournament.standings.more_in_bracket", {
                count: group.moreGames,
              })
            }}
            <ArrowRight class="h-3 w-3" />
          </NuxtLink>
        </section>

        <section v-if="group.standings.bands.length">
          <h5 v-if="group.standings.remaining" :class="labelClasses">
            {{ $t("tournament.standings.knocked_out") }}
          </h5>
          <div class="overflow-hidden rounded-md border border-border">
            <div
              class="grid h-8 grid-cols-[6.5rem_minmax(0,1fr)_3.5rem_minmax(0,1.15fr)] items-center border-b border-border bg-muted/35 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted-foreground max-sm:hidden"
            >
              <span class="pl-3.5">{{ $t("tournament.standings.place") }}</span>
              <span class="pl-3">{{ $t("team.table.team") }}</span>
              <span>{{ $t("tournament.standings.record") }}</span>
              <span>{{ $t("tournament.standings.result") }}</span>
            </div>
            <div class="divide-y divide-border">
              <div
                v-for="band in group.standings.bands"
                :key="`${band.from}-${band.to}-${band.eliminated}`"
                class="grid grid-cols-[5.25rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)]"
              >
                <div
                  class="flex flex-col justify-center gap-0.5 border-r border-border/60 px-3 py-2 sm:px-3.5"
                >
                  <span
                    class="text-[0.95rem] font-bold tabular-nums"
                    :style="{
                      color: medalColor(band, !group.standings.remaining),
                    }"
                  >
                    {{ placeLabel(band) }}
                  </span>
                  <span
                    v-if="
                      band.eliminated &&
                      band.from > 2 &&
                      band.bracket.parent_bracket?.id
                    "
                    class="text-xs text-muted-foreground"
                  >
                    {{ roundLabel(band.bracket) }}
                  </span>
                </div>
                <div class="divide-y divide-border/45">
                  <div
                    v-for="entry in band.entries"
                    :key="entry.team.id"
                    class="grid min-h-[2.625rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-y-0.5 py-1.5 sm:py-0"
                    :class="tableColumns"
                  >
                    <span
                      class="flex min-w-0 items-center gap-2 pl-3 text-sm font-semibold"
                    >
                      <span v-if="entry.team.seed" :class="seedClasses">
                        {{ entry.team.seed }}
                      </span>
                      <NuxtLink
                        v-if="entry.team.teamId"
                        :to="`/teams/${entry.team.teamId}`"
                        class="truncate transition-colors hover:text-[hsl(var(--tac-amber))]"
                      >
                        {{ entry.team.name }}
                      </NuxtLink>
                      <span v-else class="truncate">{{ entry.team.name }}</span>
                    </span>
                    <span
                      class="text-[0.8125rem] tabular-nums text-muted-foreground max-sm:pr-3"
                    >
                      {{ entry.team.wins }}–{{ entry.team.losses }}
                    </span>
                    <i18n-t
                      :keypath="
                        entry.won
                          ? 'tournament.standings.beat'
                          : 'tournament.standings.lost_to'
                      "
                      tag="span"
                      class="truncate pr-3.5 text-[0.8125rem] text-muted-foreground max-sm:col-span-2 max-sm:pl-3"
                    >
                      <template #team>
                        <span class="font-semibold text-foreground/90">{{
                          entry.opponent?.name || $t("common.tbd")
                        }}</span>
                      </template>
                      <template #score>
                        <span v-if="entry.score" class="tabular-nums">{{
                          entry.score.join("–")
                        }}</span>
                      </template>
                    </i18n-t>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </CardContent>
  </Card>
</template>
