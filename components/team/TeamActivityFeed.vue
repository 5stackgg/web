<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import gql from "graphql-tag";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Medal,
  Minus,
  Star,
  Trophy,
  UserPlus,
  X,
} from "lucide-vue-next";
import { order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import { schemaHasField } from "~/utilities/schemaHasType";
import ClipTile from "~/components/clips/ClipTile.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import AwardModal from "~/components/award/AwardModal.vue";
import {
  buildTeamActivity,
  type ActivityEvent,
} from "~/components/team/teamActivity";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import type { Clip } from "~/types/clip";

const props = defineProps<{
  team: any;
  teamAwards: any[];
}>();

const { t } = useI18n();
const { client } = useApolloClient();

const SHOWN = 10;
const WEEK_MS = 7 * 86_400_000;

// League seasons with dates, so moves can sit on the timeline.
const LEAGUE_QUERY = gql`
  query TeamActivityLeague($teamId: uuid!) {
    league_teams(where: { team_id: { _eq: $teamId } }) {
      id
      team_seasons(order_by: { created_at: desc }) {
        id
        status
        league_season_id
        season {
          id
          name
          starts_at
        }
        assigned_division {
          name
        }
      }
      movements(order_by: { created_at: desc }) {
        id
        league_season_id
        type
        final_rank
        approved_at
        season {
          name
        }
        from_division {
          name
        }
        final_to_division {
          name
        }
        computed_to_division {
          name
        }
      }
    }
  }
`;

const INVITES_QUERY = gql`
  query TeamActivityInvites($teamId: uuid!) {
    team_invites(
      where: { team_id: { _eq: $teamId } }
      order_by: { created_at: desc }
    ) {
      id
      created_at
      player {
        name
      }
      invited_by {
        name
      }
    }
  }
`;

const CREATED_AT_QUERY = gql`
  query TeamActivityCreatedAt($teamId: uuid!) {
    teams_by_pk(id: $teamId) {
      created_at
    }
  }
`;

const leagueTeams = ref<any[]>([]);
const clips = ref<Clip[]>([]);
const invites = ref<any[]>([]);
const createdAt = ref<string | null>(null);
const showAll = ref(false);

// Answers can land after the team changes; drop the stale ones.
let generation = 0;

async function loadTeamSources(teamId: string) {
  const current = ++generation;
  leagueTeams.value = [];
  createdAt.value = null;
  showAll.value = false;
  try {
    const { data } = await client.query({
      query: LEAGUE_QUERY,
      variables: { teamId },
      fetchPolicy: "cache-first",
    });
    if (current === generation) leagueTeams.value = data?.league_teams ?? [];
  } catch (error) {
    console.error("[team-activity] league query error", error);
  }
  if (!(await schemaHasField(client, "teams", "created_at"))) return;
  try {
    const { data } = await client.query({
      query: CREATED_AT_QUERY,
      variables: { teamId },
      fetchPolicy: "cache-first",
    });
    if (current === generation) {
      createdAt.value = data?.teams_by_pk?.created_at ?? null;
    }
  } catch (error) {
    console.error("[team-activity] created_at query error", error);
  }
}

async function loadInvites(teamId: string) {
  try {
    const { data } = await client.query({
      query: INVITES_QUERY,
      variables: { teamId },
      fetchPolicy: "network-only",
    });
    invites.value = data?.team_invites ?? [];
  } catch (error) {
    console.error("[team-activity] invites query error", error);
  }
}

// The team's players' public clips from the matches the feed lists, so
// each result can carry its own highlights.
async function loadClips(matchIds: string[], steamIds: string[]) {
  if (!matchIds.length || !steamIds.length) {
    clips.value = [];
    return;
  }
  try {
    const { data } = await client.query({
      query: generateQuery({
        match_clips: [
          {
            where: {
              match_map: { match_id: { _in: matchIds } },
              target_steam_id: { _in: steamIds },
              visibility: { _eq: "public" },
            },
            order_by: [{ created_at: order_by.desc }],
            limit: 120,
          } as any,
          matchClipFields,
        ],
      } as any),
      fetchPolicy: "network-only",
    });
    clips.value = ((data as any)?.match_clips ?? []) as Clip[];
  } catch (error) {
    console.error("[team-activity] clips query error", error);
  }
}

watch(
  () => props.team?.id as string | undefined,
  (teamId) => {
    if (teamId && typeof window !== "undefined") void loadTeamSources(teamId);
  },
  { immediate: true },
);

watch(
  [() => props.team?.id, () => !!props.team?.can_invite],
  ([teamId, canInvite]) => {
    invites.value = [];
    if (teamId && canInvite && typeof window !== "undefined") {
      void loadInvites(teamId);
    }
  },
  { immediate: true },
);

const rosterSteamIds = computed(() =>
  ((props.team?.roster ?? []) as any[])
    .map((entry) => entry.player?.steam_id)
    .filter(Boolean)
    .map(String)
    .sort(),
);
const recentResultIds = computed(() =>
  ((props.team?.matches ?? []) as any[])
    .filter((match) => match.status === "Finished" && match.ended_at)
    .sort((a, b) => (b.ended_at as string).localeCompare(a.ended_at))
    .slice(0, 40)
    .map((match) => match.id as string),
);
watch(
  () => `${recentResultIds.value.join(",")}|${rosterSteamIds.value.join(",")}`,
  () => {
    if (typeof window !== "undefined") {
      void loadClips(recentResultIds.value, rosterSteamIds.value);
    }
  },
  { immediate: true },
);

// The week grouping and relative times move along with the clock.
const now = ref(new Date());
const clock =
  typeof window !== "undefined"
    ? setInterval(() => (now.value = new Date()), 60_000)
    : null;
onBeforeUnmount(() => clock && clearInterval(clock));

const events = computed(() =>
  props.team
    ? buildTeamActivity({
        teamId: props.team.id,
        matches: props.team.matches ?? [],
        awards: props.teamAwards ?? [],
        leagueTeams: leagueTeams.value,
        clips: clips.value,
        invites: invites.value,
        createdAt: createdAt.value,
        now: now.value,
      })
    : [],
);

const visible = computed(() =>
  showAll.value ? events.value : events.value.slice(0, SHOWN),
);

const groups = computed(() => {
  const cutoff = now.value.getTime() - WEEK_MS;
  const week = visible.value.filter((e) => new Date(e.at).getTime() >= cutoff);
  const earlier = visible.value.filter(
    (e) => new Date(e.at).getTime() < cutoff,
  );
  return [
    { key: "week", label: t("team.activity.this_week"), events: week },
    { key: "earlier", label: t("team.activity.earlier"), events: earlier },
  ].filter((group) => group.events.length);
});

const selectedAward = ref<any | null>(null);
const awardOpen = ref(false);
function openAward(grant: any) {
  selectedAward.value = grant;
  awardOpen.value = true;
}

function awardTitleKey(event: Extract<ActivityEvent, { kind: "award" }>) {
  if (event.manual || event.placement == null) return "team.activity.received";
  if (event.placement === 1) return "team.activity.won";
  if (event.placement === 2) return "team.activity.second_at";
  if (event.placement === 3) return "team.activity.third_at";
  return "team.activity.placed_at";
}

function awardMeta(event: Extract<ActivityEvent, { kind: "award" }>) {
  if (event.manual || event.placement == null) {
    return event.grant.note || t("awards.granted");
  }
  const placement =
    {
      1: t("awards.first_place"),
      2: t("awards.second_place"),
      3: t("awards.third_place"),
    }[event.placement] ?? `#${event.placement}`;
  return `${t("team.activity.tournament")} · ${placement}`;
}

function leagueTitle(event: Extract<ActivityEvent, { kind: "league" }>) {
  switch (event.move) {
    case "promote":
      return t("team.activity.promoted", { division: event.division });
    case "relegate":
      return t("team.activity.relegated", { division: event.division });
    case "stay":
      return event.rank != null
        ? t("team.activity.finished", {
            rank: event.rank,
            division: event.division,
          })
        : t("team.activity.stayed", { division: event.division });
    default:
      return t("team.activity.started", { season: event.season });
  }
}

const TIER_COLORS: Record<string, string> = {
  mvp: "text-[hsl(195_85%_60%)]",
  gold: "text-[hsl(45_95%_60%)]",
  silver: "text-[hsl(0_0%_78%)]",
  bronze: "text-[hsl(28_70%_52%)]",
  special: "text-[hsl(258_90%_74%)]",
};

const tileBase =
  "grid size-8 shrink-0 place-items-center rounded-md bg-muted/55 text-foreground/80";
const metaClasses =
  "text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]";
const inlineButton =
  "rounded-sm text-left underline decoration-muted-foreground/40 underline-offset-[3px] transition-colors hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]";
</script>

<template>
  <section aria-labelledby="team-activity-label">
    <h2
      id="team-activity-label"
      :class="[tacticalSectionLabelClasses, '!flex']"
    >
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("team.activity.title") }}
    </h2>

    <p
      v-if="!events.length"
      class="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground"
    >
      {{ $t("team.activity.empty", { team: team?.name }) }}
    </p>

    <template v-else>
      <div v-for="group in groups" :key="group.key">
        <h3
          class="mb-0.5 mt-[18px] text-xs font-semibold text-muted-foreground first:mt-0"
        >
          {{ group.label }}
        </h3>
        <ul>
          <li
            v-for="event in group.events"
            :key="event.key"
            class="relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 py-2.5"
          >
            <!-- Result -->
            <template v-if="event.kind === 'result'">
              <span
                aria-hidden="true"
                :class="[
                  tileBase,
                  event.result === 'W' && 'bg-success/10 text-success',
                  event.result === 'L' && 'bg-destructive/10 text-destructive',
                ]"
              >
                <Check v-if="event.result === 'W'" class="size-4" />
                <X v-else-if="event.result === 'L'" class="size-4" />
                <Minus v-else class="size-4" />
              </span>
              <div class="grid min-w-0 gap-0.5">
                <span
                  class="text-[13.5px] font-semibold [overflow-wrap:anywhere]"
                >
                  <i18n-t
                    :keypath="
                      event.result === 'W'
                        ? 'team.activity.beat'
                        : event.result === 'L'
                          ? 'team.activity.lost_to'
                          : 'team.activity.drew_with'
                    "
                    scope="global"
                  >
                    <template #opponent>
                      <NuxtLink
                        v-if="event.opponent.teamId"
                        :to="{
                          name: 'teams-id',
                          params: { id: event.opponent.teamId },
                        }"
                        class="relative z-10 hover:underline"
                        >{{ event.opponent.name }}</NuxtLink
                      >
                      <span v-else>{{ event.opponent.name }}</span>
                    </template>
                  </i18n-t>
                  <NuxtLink
                    :to="{ name: 'matches-id', params: { id: event.matchId } }"
                    class="ml-1.5 tabular-nums text-foreground/70 after:absolute after:inset-0 after:content-[''] hover:text-foreground focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-[hsl(var(--tac-amber))]"
                    :aria-label="
                      event.score
                        ? `${$t('team.activity.open_match')} ${event.score[0]}–${event.score[1]}`
                        : undefined
                    "
                  >
                    <template v-if="event.score"
                      >{{ event.score[0] }}–{{ event.score[1] }}</template
                    >
                    <template v-else>{{
                      $t("team.activity.open_match")
                    }}</template>
                  </NuxtLink>
                </span>
                <span v-if="event.context.length" :class="metaClasses">
                  {{ event.context.join(" · ") }}
                </span>
              </div>
              <!-- The match's highlights, as a small rail under the result.
                   z-10 keeps the tiles above the row's stretched match link. -->
              <div
                v-if="event.clips.length"
                class="relative z-10 col-start-2 col-end-4 row-start-2 min-w-0"
              >
                <HorizontalScrollRow>
                  <div
                    v-for="clip in event.clips"
                    :key="clip.id"
                    class="w-48 shrink-0 snap-start"
                  >
                    <ClipTile
                      :clip="clip"
                      :queue="event.clips"
                      :queue-scope="`team-activity:${event.matchId}`"
                    />
                  </div>
                </HorizontalScrollRow>
              </div>
            </template>

            <!-- Award -->
            <template v-else-if="event.kind === 'award'">
              <span
                aria-hidden="true"
                :class="[tileBase, TIER_COLORS[event.tier]]"
              >
                <Medal v-if="event.manual" class="size-4" />
                <Trophy v-else class="size-4" />
              </span>
              <div class="grid min-w-0 gap-0.5">
                <span class="text-[13.5px] font-semibold">
                  <button
                    type="button"
                    :class="inlineButton"
                    @click="openAward(event.grant)"
                  >
                    <i18n-t :keypath="awardTitleKey(event)" scope="global">
                      <template #name
                        ><b class="font-bold">{{ event.name }}</b></template
                      >
                      <template #placement>#{{ event.placement }}</template>
                    </i18n-t>
                  </button>
                </span>
                <span :class="metaClasses">{{ awardMeta(event) }}</span>
              </div>
            </template>

            <!-- League -->
            <template v-else-if="event.kind === 'league'">
              <span
                aria-hidden="true"
                :class="[
                  tileBase,
                  event.move === 'promote' && 'text-success',
                  event.move === 'relegate' && 'text-destructive',
                  event.move === 'start' && 'text-[hsl(var(--tac-amber))]',
                ]"
              >
                <ArrowUp v-if="event.move === 'promote'" class="size-4" />
                <ArrowDown
                  v-else-if="event.move === 'relegate'"
                  class="size-4"
                />
                <BarChart3 v-else-if="event.move === 'stay'" class="size-4" />
                <CalendarDays v-else class="size-4" />
              </span>
              <div class="grid min-w-0 gap-0.5">
                <span
                  class="text-[13.5px] font-semibold [overflow-wrap:anywhere]"
                >
                  {{ leagueTitle(event) }}
                </span>
                <NuxtLink
                  :to="{
                    name: 'league-seasons-seasonId',
                    params: { seasonId: event.seasonId },
                  }"
                  :class="[
                    metaClasses,
                    'w-fit hover:text-foreground hover:underline',
                  ]"
                >
                  {{
                    event.move === "start" && event.division
                      ? `${event.season} · ${event.division}`
                      : event.season
                  }}
                </NuxtLink>
              </div>
            </template>

            <!-- Invite -->
            <template v-else-if="event.kind === 'invite'">
              <span aria-hidden="true" :class="tileBase">
                <UserPlus class="size-4" />
              </span>
              <div class="grid min-w-0 gap-0.5">
                <span
                  class="text-[13.5px] font-semibold [overflow-wrap:anywhere]"
                >
                  {{ $t("team.activity.invited", { name: event.name }) }}
                </span>
                <span v-if="event.by" :class="metaClasses">
                  {{ $t("team.activity.invited_by", { name: event.by }) }}
                </span>
              </div>
            </template>

            <!-- Team created -->
            <template v-else>
              <span aria-hidden="true" :class="tileBase">
                <Star class="size-4" />
              </span>
              <span
                class="text-[13.5px] font-semibold [overflow-wrap:anywhere]"
              >
                {{ $t("team.activity.created", { team: team?.name }) }}
              </span>
            </template>

            <span
              class="col-start-3 row-start-1 text-right text-xs text-muted-foreground"
            >
              <TimeAgo :date="event.at" hide-icon />
            </span>
          </li>
        </ul>
      </div>

      <button
        v-if="!showAll && events.length > SHOWN"
        type="button"
        class="relative mt-2.5 inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] [@media(pointer:fine)]:after:hidden"
        @click="showAll = true"
      >
        {{ $t("team.activity.show_older") }}
        <ChevronDown class="size-3.5" />
      </button>
    </template>

    <AwardModal
      v-if="selectedAward"
      :open="awardOpen"
      :award="selectedAward"
      @update:open="(v) => (awardOpen = v)"
    />
  </section>
</template>
