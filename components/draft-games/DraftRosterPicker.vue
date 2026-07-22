<script setup lang="ts">
import { ref, computed, watch } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

type RosterMember = {
  steam_id: string;
  name?: string;
  avatar_url?: string | null;
  status?: string;
};

// `lineup` is the starting slot (null when benched); `side` is the team they
// belong to either way, so a benched member becomes that side's backup rather
// than a spare with no team.
type Assignment = {
  steam_id: string;
  lineup: number | null;
  side: number | null;
};

const props = defineProps<{
  team1?: { id: string; name?: string } | null;
  team2?: { id: string; name?: string } | null;
  perTeam: number;
  innerSquad?: boolean;
  initialAssignment?: Record<string, number | null>;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: Array<Assignment>): void;
}>();

const rosters = ref<Record<string, RosterMember[]>>({});
const teamNames = ref<Record<string, string>>({});
const assignment = ref<Record<string, number | null>>({});

const fetchRoster = async (teamId: string): Promise<RosterMember[]> => {
  if (rosters.value[teamId]) {
    return rosters.value[teamId];
  }
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      teams_by_pk: [
        { id: teamId },
        {
          name: true,
          roster: [
            { where: { status: { _in: ["Starter", "Substitute"] } } },
            {
              status: true,
              player: {
                steam_id: true,
                name: true,
                avatar_url: true,
              },
            },
          ],
        },
      ],
    }),
  });
  const members: RosterMember[] = (data?.teams_by_pk?.roster || [])
    .map((row: any) => ({
      steam_id: String(row.player.steam_id),
      name: row.player.name,
      avatar_url: row.player.avatar_url,
      status: row.status,
    }))
    .sort((a: RosterMember, b: RosterMember) => {
      const aStarter = a.status === "Starter" ? 0 : 1;
      const bStarter = b.status === "Starter" ? 0 : 1;
      if (aStarter !== bStarter) {
        return aStarter - bStarter;
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  if (data?.teams_by_pk?.name) {
    teamNames.value = { ...teamNames.value, [teamId]: data.teams_by_pk.name };
  }
  rosters.value = { ...rosters.value, [teamId]: members };
  return members;
};

const nameFor = (team?: { id: string; name?: string } | null) =>
  (team?.id && teamNames.value[team.id]) || team?.name || "";

const emitRoster = () => {
  const entries: Array<Assignment> = [];
  const seen = new Set<string>();
  const pushTeam = (teamId: string | undefined, side: number) => {
    if (!teamId) {
      return;
    }
    for (const member of rosters.value[teamId] || []) {
      if (seen.has(member.steam_id)) {
        continue;
      }
      seen.add(member.steam_id);
      const lineup = assignment.value[member.steam_id] ?? null;
      entries.push({
        steam_id: member.steam_id,
        lineup,
        side: lineup ?? side,
      });
    }
  };
  pushTeam(props.team1?.id, 1);
  if (!props.innerSquad) {
    pushTeam(props.team2?.id, 2);
  }
  emit("update:modelValue", entries);
};

const rebuild = async () => {
  const next: Record<string, number | null> = {};
  const initial = props.initialAssignment;

  const defaultLineup = (index: number, lineup: number) =>
    index < props.perTeam ? lineup : null;

  if (props.team1?.id) {
    const team1 = await fetchRoster(props.team1.id);
    team1.forEach((member, index) => {
      next[member.steam_id] =
        initial && member.steam_id in initial
          ? initial[member.steam_id]
          : props.innerSquad
            ? index < props.perTeam
              ? 1
              : index < props.perTeam * 2
                ? 2
                : null
            : defaultLineup(index, 1);
    });

    if (!props.innerSquad && props.team2?.id) {
      const team2 = await fetchRoster(props.team2.id);
      team2.forEach((member, index) => {
        if (member.steam_id in next) {
          return;
        }
        next[member.steam_id] =
          initial && member.steam_id in initial
            ? initial[member.steam_id]
            : defaultLineup(index, 2);
      });
    }
  }

  assignment.value = next;
  emitRoster();
};

watch(
  () => [props.team1?.id, props.team2?.id, props.innerSquad, props.perTeam],
  rebuild,
  { immediate: true },
);

const countFor = (lineup: number) =>
  Object.values(assignment.value).filter((value) => value === lineup).length;

const sideFull = (lineup: number) => countFor(lineup) >= props.perTeam;

const setSide = (steamId: string, lineup: number | null) => {
  const current = assignment.value[steamId] ?? null;
  const target = current === lineup ? null : lineup;
  if (target !== null && current !== target && sideFull(target)) {
    return;
  }
  assignment.value = { ...assignment.value, [steamId]: target };
  emitRoster();
};

const team1Members = computed(() =>
  props.team1?.id ? rosters.value[props.team1.id] || [] : [],
);
const team2Members = computed(() =>
  props.team2?.id ? rosters.value[props.team2.id] || [] : [],
);
</script>

<template>
  <div v-if="team1?.id" class="space-y-4">
    <section v-if="innerSquad">
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        {{ nameFor(team1) || $t("draft_games.create.team_1_required") }}
        <span class="ml-1 text-muted-foreground/70">
          (A {{ countFor(1) }}/{{ perTeam }} · B {{ countFor(2) }}/{{ perTeam }})
        </span>
      </div>
      <div class="mt-2 space-y-1.5">
        <div
          v-for="member in team1Members"
          :key="member.steam_id"
          class="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2"
        >
          <PlayerDisplay :player="member" size="sm" :linkable="false" />
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="side-btn side-amber"
              :class="{ active: assignment[member.steam_id] === 1 }"
              :disabled="
                assignment[member.steam_id] !== 1 && sideFull(1)
              "
              @click="setSide(member.steam_id, 1)"
            >
              A
            </button>
            <button
              type="button"
              class="side-btn side-blue"
              :class="{ active: assignment[member.steam_id] === 2 }"
              :disabled="
                assignment[member.steam_id] !== 2 && sideFull(2)
              "
              @click="setSide(member.steam_id, 2)"
            >
              B
            </button>
          </div>
        </div>
      </div>
    </section>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <section
        v-for="side in [
          { lineup: 1, team: team1, members: team1Members },
          { lineup: 2, team: team2, members: team2Members },
        ].filter((s) => s.team?.id)"
        :key="side.lineup"
      >
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses"></span>
          {{
            nameFor(side.team) ||
            $t("draft_games.room.team", { team: side.lineup })
          }}
          <span class="ml-1 text-muted-foreground/70">
            ({{ countFor(side.lineup) }}/{{ perTeam }})
          </span>
        </div>
        <div class="mt-2 space-y-1.5">
          <div
            v-for="member in side.members"
            :key="member.steam_id"
            class="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2"
            :class="{
              'opacity-50': assignment[member.steam_id] !== side.lineup,
            }"
          >
            <PlayerDisplay :player="member" size="sm" :linkable="false" />
            <button
              type="button"
              class="side-btn"
              :class="
                assignment[member.steam_id] === side.lineup
                  ? side.lineup === 1
                    ? 'side-amber active'
                    : 'side-blue active'
                  : ''
              "
              :disabled="
                assignment[member.steam_id] !== side.lineup && sideFull(side.lineup)
              "
              @click="setSide(member.steam_id, side.lineup)"
            >
              {{
                assignment[member.steam_id] === side.lineup
                  ? $t("draft_games.create.starting")
                  : $t("draft_games.create.bench")
              }}
            </button>
          </div>
          <p
            v-if="side.members.length === 0"
            class="px-1 py-2 text-[0.72rem] text-muted-foreground"
          >
            {{ $t("draft_games.create.no_roster") }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.side-btn {
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--border));
  padding: 0.25rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
  transition: all 0.15s ease;
}
.side-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.side-btn.side-amber.active {
  border-color: hsl(var(--tac-amber));
  background: hsl(var(--tac-amber) / 0.12);
  color: hsl(var(--tac-amber));
}
.side-btn.side-blue.active {
  border-color: hsl(200 90% 62%);
  background: hsl(200 90% 62% / 0.12);
  color: hsl(200 90% 62%);
}
</style>
