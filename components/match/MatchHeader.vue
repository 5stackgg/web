<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { AlertTriangle } from "lucide-vue-next";
import { NuxtLink } from "#components";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchSourceBadge from "~/components/MatchSourceBadge.vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { e_match_status_enum } from "~/generated/zeus";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { dateLocale } from "~/utilities/dateLocale";
import mapLabel from "~/utilities/mapLabel";
import { teamMonogram } from "~/components/watch/watchTicker";

const props = defineProps<{
  match: any;
}>();

const { t } = useI18n();
const apiDomain = computed(() => useRuntimeConfig().public.apiDomain as string);

const SCORED = [
  e_match_status_enum.Live,
  e_match_status_enum.Finished,
  e_match_status_enum.Forfeit,
  e_match_status_enum.Surrendered,
  e_match_status_enum.Tie,
];
const ENDED = [
  e_match_status_enum.Finished,
  e_match_status_enum.Forfeit,
  e_match_status_enum.Surrendered,
  e_match_status_enum.Tie,
  e_match_status_enum.Canceled,
];

const isLive = computed(() => props.match.status === e_match_status_enum.Live);
const isEnded = computed(() => ENDED.includes(props.match.status));
const isNative = computed(
  () => !props.match.source || props.match.source === "5stack",
);
const bestOf = computed<number>(() => props.match.options?.best_of ?? 1);
const maps = computed<any[]>(() => props.match.match_maps ?? []);
const statusText = computed(
  () => props.match.e_match_status?.description || props.match.status,
);

const statusTone = computed(() => {
  switch (props.match.status) {
    case e_match_status_enum.Live:
      return "text-destructive";
    case e_match_status_enum.Scheduled:
    case e_match_status_enum.WaitingForCheckIn:
    case e_match_status_enum.WaitingForServer:
      return "text-[hsl(var(--tac-amber))]";
    case e_match_status_enum.Veto:
    case e_match_status_enum.PickingPlayers:
      return "text-[hsl(var(--topnav-accent))]";
    case e_match_status_enum.Finished:
      return "text-success";
    default:
      return "text-muted-foreground";
  }
});

const tournament = computed(
  () => props.match.tournament_brackets?.[0]?.stage?.tournament ?? null,
);

const formattedSchedule = computed(() => {
  const when = props.match.scheduled_at || props.match.ended_at;
  if (!when) return null;
  try {
    return new Date(when).toLocaleString(dateLocale(), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
});

const showAutoCancel = computed(
  () =>
    props.match.cancels_at &&
    props.match.status !== e_match_status_enum.Canceled,
);

// A pickup game's lineups are named after their captains, so the captain's
// face stands in for the missing team crest.
const isPug = computed(
  () => !props.match.lineup_1?.team_id && !props.match.lineup_2?.team_id,
);

const playerAvatar = (player: any) =>
  resolveAvatarUrl(
    player?.custom_avatar_url || player?.avatar_url,
    apiDomain.value,
  );

const teams = computed(() =>
  [props.match.lineup_1, props.match.lineup_2].map((lineup, i) => {
    const id = i === 0 ? props.match.lineup_1_id : props.match.lineup_2_id;
    const name =
      lineup?.name ||
      t(i === 0 ? "match.lineup.lineup_1" : "match.lineup.lineup_2");
    const players = (lineup?.lineup_players ?? []).filter(
      (member: any) => member.player,
    );
    const captain = players.find((member: any) => member.captain)?.player;
    return {
      id,
      name,
      teamId: lineup?.team_id ?? null,
      crest:
        resolveAvatarUrl(lineup?.team?.avatar_url, apiDomain.value) ??
        (isPug.value ? playerAvatar(captain) : null),
      monogram: teamMonogram(name),
      roster: players.slice(0, 5).map((member: any) => ({
        steamId: member.player.steam_id,
        name: member.player.name,
        src: playerAvatar(member.player),
      })),
      mapsWon: maps.value.filter((m) => id && m.winning_lineup_id === id)
        .length,
      won: isEnded.value && !!id && props.match.winning_lineup_id === id,
      // Your side gets an amber ring on its crest.
      mine: !!lineup?.is_on_lineup,
      lost:
        isEnded.value &&
        !!props.match.winning_lineup_id &&
        props.match.winning_lineup_id !== id,
    };
  }),
);

const winsNeeded = computed(() =>
  bestOf.value > 1 ? Math.ceil(bestOf.value / 2) : 0,
);

const currentMap = computed(() =>
  isLive.value ? (maps.value.find((m) => m.is_current_map) ?? null) : null,
);

// What the two big numbers read: the map being played, the only map of a Bo1,
// or (map: null) the maps won in a series. Null until there is a score.
const headline = computed<{ map: any } | null>(() => {
  if (!SCORED.includes(props.match.status)) return null;
  if (currentMap.value) return { map: currentMap.value };
  if (bestOf.value === 1) {
    const map = maps.value[0];
    if (!map || (map.lineup_1_score ?? 0) + (map.lineup_2_score ?? 0) === 0) {
      return null;
    }
    return { map };
  }
  return teams.value.some((team) => team.mapsWon > 0) ? { map: null } : null;
});

const lineups = computed(() => [props.match.lineup_1, props.match.lineup_2]);

// Every slot of a series, played or not, so a Bo5 shows all five.
const mapChips = computed(() => {
  if (bestOf.value === 1) return [];
  const slots = maps.value.map((m) => ({ key: m.id, matchMap: m }));
  if (!isEnded.value) {
    for (let i = slots.length; i < bestOf.value; i++) {
      slots.push({ key: `slot-${i}`, matchMap: null });
    }
  }
  return slots;
});

const metaFacts = computed(() =>
  [
    props.match.options?.type,
    isNative.value && props.match.options?.best_of
      ? t("match.options.best_of.option", {
          count: props.match.options.best_of,
        })
      : null,
    isNative.value ? props.match.e_region?.description : null,
  ]
    .filter(Boolean)
    .join(" · "),
);

const metaLine = computed(() =>
  [metaFacts.value, formattedSchedule.value].filter(Boolean).join(" · "),
);

const resultText = computed(() =>
  props.match.status === e_match_status_enum.Finished
    ? t("match.header.final")
    : statusText.value,
);
</script>

<template>
  <div
    class="grid gap-4 bg-[linear-gradient(180deg,rgb(255_255_255/0.035),transparent_70%)] px-4 pb-5 pt-4 md:gap-[18px] md:px-6"
  >
    <div class="flex items-start gap-3">
      <div
        class="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1"
      >
        <span
          class="inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold"
          :class="statusTone"
        >
          <span class="relative flex size-2 shrink-0">
            <span
              v-if="isLive"
              class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75 motion-reduce:animate-none"
            ></span>
            <span
              class="relative inline-flex size-2 rounded-full bg-current"
            ></span>
          </span>
          <span class="text-foreground">{{ statusText }}</span>
          <TimeAgo
            v-if="isEnded && match.ended_at"
            :date="match.ended_at"
            hide-icon
            class="font-medium text-muted-foreground"
          />
        </span>

        <span
          v-if="tournament || match.label"
          class="inline-flex min-w-0 items-center gap-1.5 text-[13px]"
        >
          <NuxtLink
            v-if="tournament"
            :to="`/tournaments/${tournament.id}`"
            class="truncate rounded-sm font-semibold text-foreground/85 transition-colors hover:text-[hsl(var(--tac-amber))]"
          >
            {{ tournament.name }}
          </NuxtLink>
          <span v-if="match.label" class="truncate text-muted-foreground">
            <template v-if="tournament">· </template>{{ match.label }}
          </span>
        </span>
      </div>

      <div class="flex h-9 shrink-0 items-center gap-2">
        <MatchSourceBadge
          v-if="match.source !== 'faceit'"
          :source="match.source"
          class="self-stretch px-[0.7rem] text-[0.62rem] leading-none"
        />
        <MatchActions :match="match" />
      </div>
    </div>

    <!-- Desktop: a broadcast scorebug, names outside, crests against the box. -->
    <div
      class="hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-5 md:grid"
    >
      <template v-for="(team, i) in teams" :key="team.id ?? i">
        <div
          class="flex min-w-0 items-center gap-4"
          :class="i === 0 ? 'flex-row-reverse text-right' : ''"
        >
          <component
            :is="team.teamId ? NuxtLink : 'span'"
            :to="team.teamId ? `/teams/${team.teamId}` : undefined"
            aria-hidden="true"
            :tabindex="team.teamId ? -1 : undefined"
            class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-muted text-sm font-extrabold tracking-wide text-foreground/85 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.8)]"
            :class="[
              team.mine
                ? 'ring-2 ring-[hsl(var(--tac-amber))]'
                : 'ring-1 ring-inset ring-white/10',
              team.teamId && 'transition-opacity hover:opacity-80',
            ]"
          >
            <img
              v-if="team.crest"
              :src="team.crest"
              alt=""
              class="size-full object-cover"
            />
            <template v-else>{{ team.monogram }}</template>
          </component>

          <div
            class="grid min-w-0 gap-1.5"
            :class="i === 0 ? 'justify-items-end' : 'justify-items-start'"
          >
            <component
              :is="team.teamId ? NuxtLink : 'h2'"
              :to="team.teamId ? `/teams/${team.teamId}` : undefined"
              :title="team.name"
              class="line-clamp-2 text-[clamp(1.25rem,2.2vw,1.625rem)] leading-[1.12] [text-wrap:balance]"
              :class="[
                team.lost
                  ? 'font-semibold text-muted-foreground'
                  : 'font-bold text-foreground',
                team.teamId &&
                  'rounded-sm transition-colors hover:text-[hsl(var(--tac-amber))]',
              ]"
            >
              {{ team.name }}
              <span v-if="team.won" class="sr-only">{{
                $t("match.header.winner")
              }}</span>
            </component>
            <div
              class="flex items-center gap-2"
              :class="i === 0 && 'flex-row-reverse'"
            >
              <div v-if="team.roster.length" class="flex -space-x-[5px]">
                <Avatar
                  v-for="player in team.roster"
                  :key="player.steamId"
                  class="size-5 text-[9px] ring-2 ring-black/50"
                  :title="player.name"
                >
                  <AvatarImage v-if="player.src" :src="player.src" alt="" />
                  <AvatarFallback>{{
                    player.name?.slice(0, 1)
                  }}</AvatarFallback>
                </Avatar>
              </div>
              <span v-if="winsNeeded" class="inline-flex gap-[3px]">
                <i
                  v-for="p in winsNeeded"
                  :key="p"
                  class="size-1.5 rounded-[1px]"
                  :class="
                    p <= team.mapsWon
                      ? 'bg-[hsl(var(--tac-amber))]'
                      : 'bg-muted-foreground/30'
                  "
                ></i>
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="i === 0"
          class="flex min-h-[72px] items-stretch overflow-hidden rounded-[10px] bg-black/40 ring-1 ring-inset ring-white/[0.09]"
        >
          <template v-if="headline">
            <MatchLineupScoreDisplay
              :match="match"
              :lineup="lineups[0]"
              :match-map="headline.map ?? undefined"
              :halves="false"
              class="grid min-w-[76px] place-items-center px-3.5 text-[42px] leading-none tabular-nums text-foreground [&>span]:font-extrabold"
            />
            <span
              class="grid min-w-[120px] place-content-center justify-items-center gap-1 whitespace-nowrap border-x border-white/[0.08] px-4 py-2 text-xs text-muted-foreground"
            >
              <template v-if="headline.map">
                <span
                  class="inline-flex items-center gap-1.5 text-[13px] font-bold text-foreground"
                >
                  <span v-if="isLive" class="relative flex size-2">
                    <span
                      class="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
                    ></span>
                    <span
                      class="relative inline-flex size-2 rounded-full bg-destructive"
                    ></span>
                  </span>
                  <img
                    v-else-if="headline.map.map?.patch"
                    :src="headline.map.map.patch"
                    alt=""
                    class="size-4 object-contain"
                  />
                  {{ mapLabel(headline.map.map) }}
                </span>
                <!-- T/CT rounds per side, the same split the map card shows. -->
                <span class="text-[15px] tabular-nums">
                  <MatchLineupScoreDisplay
                    :match="match"
                    :lineup="lineups[0]"
                    :match-map="headline.map"
                    :score="false"
                  />
                  :
                  <MatchLineupScoreDisplay
                    :match="match"
                    :lineup="lineups[1]"
                    :match-map="headline.map"
                    :score="false"
                  />
                </span>
              </template>
              <template v-else>
                <span class="text-[13px] font-bold text-foreground">{{
                  resultText
                }}</span>
                <span>{{
                  $t("match.options.best_of.option", { count: bestOf })
                }}</span>
              </template>
            </span>
            <MatchLineupScoreDisplay
              :match="match"
              :lineup="lineups[1]"
              :match-map="headline.map ?? undefined"
              :halves="false"
              class="grid min-w-[76px] place-items-center px-3.5 text-[42px] leading-none tabular-nums text-foreground [&>span]:font-extrabold"
            />
          </template>
          <span
            v-else
            class="grid min-w-[120px] place-items-center px-4 text-lg font-bold text-muted-foreground"
          >
            {{ isEnded ? statusText : $t("common.vs") }}
          </span>
        </div>
      </template>
    </div>

    <!-- Phone: the same facts as two team rows. -->
    <div class="grid gap-2.5 md:hidden">
      <div
        v-for="(team, i) in teams"
        :key="team.id ?? i"
        class="flex min-w-0 items-center gap-3"
      >
        <span
          aria-hidden="true"
          class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-xs font-extrabold tracking-wide text-foreground/85"
          :class="
            team.mine
              ? 'ring-2 ring-[hsl(var(--tac-amber))]'
              : 'ring-1 ring-inset ring-white/10'
          "
        >
          <img
            v-if="team.crest"
            :src="team.crest"
            alt=""
            class="size-full object-cover"
          />
          <template v-else>{{ team.monogram }}</template>
        </span>
        <component
          :is="team.teamId ? NuxtLink : 'span'"
          :to="team.teamId ? `/teams/${team.teamId}` : undefined"
          class="line-clamp-2 min-w-0 flex-1 text-[17px] leading-tight"
          :class="
            team.lost
              ? 'font-semibold text-muted-foreground'
              : 'font-bold text-foreground'
          "
        >
          {{ team.name }}
          <span v-if="team.won" class="sr-only">{{
            $t("match.header.winner")
          }}</span>
        </component>
        <span v-if="winsNeeded" class="inline-flex shrink-0 gap-[3px]">
          <i
            v-for="p in winsNeeded"
            :key="p"
            class="size-1.5 rounded-[1px]"
            :class="
              p <= team.mapsWon
                ? 'bg-[hsl(var(--tac-amber))]'
                : 'bg-muted-foreground/30'
            "
          ></i>
        </span>
        <MatchLineupScoreDisplay
          v-if="headline"
          :match="match"
          :lineup="lineups[i]"
          :match-map="headline.map ?? undefined"
          :halves="false"
          class="min-w-[2ch] text-right text-[28px] leading-none tabular-nums text-foreground [&>span]:font-extrabold"
        />
        <span
          v-else
          class="min-w-[2ch] text-right text-[28px] font-extrabold leading-none text-muted-foreground"
          >–</span
        >
      </div>
      <span
        v-if="headline?.map"
        class="flex items-center gap-1.5 pl-[52px] text-[15px] tabular-nums"
        :class="
          isLive ? 'font-semibold text-destructive' : 'text-muted-foreground'
        "
      >
        {{ mapLabel(headline.map.map) }}
        <MatchLineupScoreDisplay
          :match="match"
          :lineup="lineups[0]"
          :match-map="headline.map"
          :score="false"
        />
        :
        <MatchLineupScoreDisplay
          :match="match"
          :lineup="lineups[1]"
          :match-map="headline.map"
          :score="false"
        />
      </span>
    </div>

    <div
      class="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground md:justify-center"
    >
      <!-- Phone: the series as one divided strip, a cell per map. -->
      <div
        v-if="mapChips.length"
        class="grid w-full auto-cols-fr grid-flow-col divide-x divide-white/[0.07] overflow-hidden rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] md:hidden"
      >
        <div
          v-for="(chip, index) in mapChips"
          :key="chip.key"
          class="grid min-w-0 justify-items-center gap-1 px-1.5 py-2"
          :class="
            chip.matchMap?.is_current_map && isLive
              ? 'bg-destructive/10 text-foreground/90'
              : chip.matchMap
                ? 'text-foreground/90'
                : 'text-muted-foreground/60'
          "
        >
          <span
            class="flex min-w-0 max-w-full items-center gap-1.5 text-[12px] leading-none"
          >
            <img
              v-if="chip.matchMap?.map?.patch && mapChips.length <= 3"
              :src="chip.matchMap.map.patch"
              alt=""
              class="size-3.5 shrink-0 object-contain"
            />
            <span class="truncate">{{
              chip.matchMap
                ? mapLabel(chip.matchMap.map)
                : $t("match.map_number", { count: index + 1 })
            }}</span>
          </span>
          <span
            v-if="chip.matchMap"
            class="text-[13px] font-semibold leading-none tabular-nums"
          >
            <MatchLineupScoreDisplay
              :match="match"
              :lineup="lineups[0]"
              :match-map="chip.matchMap"
              :halves="false"
            />–<MatchLineupScoreDisplay
              :match="match"
              :lineup="lineups[1]"
              :match-map="chip.matchMap"
              :halves="false"
            />
          </span>
          <span v-else class="text-[13px] leading-none">–</span>
        </div>
      </div>

      <span
        v-for="(chip, index) in mapChips"
        :key="chip.key"
        class="inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-md pl-2 pr-2.5 max-md:hidden"
        :class="
          !chip.matchMap
            ? 'outline-dashed outline-1 -outline-offset-1 outline-white/[0.11]'
            : chip.matchMap.is_current_map && isLive
              ? 'bg-white/[0.04] text-foreground/90 ring-1 ring-inset ring-destructive/45'
              : 'bg-white/[0.04] text-foreground/90 ring-1 ring-inset ring-white/[0.07]'
        "
      >
        <template v-if="chip.matchMap">
          <img
            v-if="chip.matchMap.map?.patch"
            :src="chip.matchMap.map.patch"
            alt=""
            class="size-4 object-contain"
          />
          {{ mapLabel(chip.matchMap.map) }}
          <span class="tabular-nums text-muted-foreground">
            <MatchLineupScoreDisplay
              :match="match"
              :lineup="lineups[0]"
              :match-map="chip.matchMap"
              :halves="false"
            />–<MatchLineupScoreDisplay
              :match="match"
              :lineup="lineups[1]"
              :match-map="chip.matchMap"
              :halves="false"
            />
          </span>
        </template>
        <template v-else>
          {{ $t("match.map_number", { count: index + 1 }) }}
        </template>
      </span>

      <span v-if="metaLine" class="inline-flex h-7 items-center max-md:hidden">
        {{ metaLine }}
      </span>
      <span v-if="metaLine" class="grid w-full gap-1 leading-snug md:hidden">
        <span v-if="metaFacts">{{ metaFacts }}</span>
        <span v-if="formattedSchedule">{{ formattedSchedule }}</span>
      </span>

      <span
        v-if="showAutoCancel"
        class="inline-flex h-7 items-center gap-1.5 text-destructive"
      >
        <AlertTriangle class="size-3.5 shrink-0" />
        {{ $t("match.auto_canceling") }}
        <TimeAgo :date="match.cancels_at" countdown hide-icon />
      </span>
    </div>
  </div>
</template>
