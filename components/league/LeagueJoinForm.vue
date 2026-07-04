<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import RosterSlotPicker from "~/components/RosterSlotPicker.vue";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";
import { generateQuery } from "~/graphql/graphqlGen";
import type { LeagueDivision } from "~/components/league/DivisionTierEditor.vue";

interface ManagedTeam {
  id: string;
  name: string;
  roster: {
    player_steam_id: string;
    status?: string;
    player: { steam_id: string; name: string; avatar_url: string | null };
  }[];
}

const props = defineProps<{
  teams: ManagedTeam[];
  divisions: LeagueDivision[];
  minRosterSize: number;
  maxRosterSize: number;
  registeredTeamIds: string[];
  canSelectAnyTeam?: boolean;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (
    e: "register",
    teamId: string,
    requestedDivisionId: string | null,
    roster: { playerSteamId: string; status: string }[],
  ): void;
}>();

const { client: apolloClient } = useApolloClient();

const selectedTeamId = ref<string>("");
const requestedDivisionId = ref<string>("");
// steamId -> "Starter" | "Substitute"; absent = not on the season roster.
const assignment = ref<Record<string, string>>({});

// Admin "register any team" mode fetches the chosen team's roster on demand.
const adminTeam = ref<ManagedTeam | null>(null);

const allowDivisionRequest = computed(
  () => useApplicationSettingsStore().leagueAllowDivisionRequest,
);

// Lineup caps mirror the season page: `minRosterSize` starters + the rest subs.
const startersCap = computed(() => props.minRosterSize);
const subsCap = computed(() =>
  Math.max(0, props.maxRosterSize - props.minRosterSize),
);

const availableTeams = computed(() =>
  props.teams.filter((team) => !props.registeredTeamIds.includes(team.id)),
);

const selectedTeam = computed<ManagedTeam | null>(() => {
  if (props.canSelectAnyTeam) {
    return adminTeam.value;
  }
  return (
    availableTeams.value.find((t) => t.id === selectedTeamId.value) ?? null
  );
});

async function selectAnyTeam(team: { id: string; name: string }) {
  selectedTeamId.value = team.id;
  const { data } = await apolloClient.query({
    query: generateQuery({
      teams: [
        { where: { id: { _eq: team.id } } },
        {
          id: true,
          name: true,
          roster: [
            {},
            {
              player_steam_id: true,
              status: true,
              player: { steam_id: true, name: true, avatar_url: true },
            },
          ],
        },
      ],
    }),
    fetchPolicy: "network-only",
  });
  const fetched = (data.teams || [])[0];
  adminTeam.value = fetched
    ? {
        id: fetched.id,
        name: fetched.name,
        roster: (fetched.roster || []).map((entry: any) => ({
          ...entry,
          player_steam_id: String(entry.player_steam_id),
        })),
      }
    : null;
}

const roster = computed(() => selectedTeam.value?.roster ?? []);

// Normalized shape for the shared slot picker.
const members = computed(() =>
  roster.value.map((m: any) => ({
    steamId: m.player_steam_id,
    player: m.player,
  })),
);

const totalSelected = computed(() => Object.keys(assignment.value).length);

// On team select, auto-fill the lineup: team starters first, then subs.
watch(selectedTeam, (team) => {
  const order: Record<string, number> = {
    Starter: 0,
    Substitute: 1,
    Benched: 2,
  };
  const prioritized = [...(team?.roster ?? [])].sort(
    (a: any, b: any) => (order[a.status] ?? 3) - (order[b.status] ?? 3),
  );
  const next: Record<string, string> = {};
  let s = 0;
  let sub = 0;
  for (const m of prioritized as any[]) {
    if (s < startersCap.value) {
      next[m.player_steam_id] = "Starter";
      s++;
    } else if (sub < subsCap.value) {
      next[m.player_steam_id] = "Substitute";
      sub++;
    }
  }
  assignment.value = next;
});

const canSubmit = computed(
  () =>
    !!selectedTeam.value &&
    totalSelected.value >= props.minRosterSize &&
    totalSelected.value <= props.maxRosterSize,
);

function submit() {
  if (!selectedTeam.value || !canSubmit.value) {
    return;
  }
  const roster = Object.entries(assignment.value).map(
    ([playerSteamId, status]) => ({ playerSteamId, status }),
  );
  emit(
    "register",
    selectedTeam.value.id,
    requestedDivisionId.value || null,
    roster,
  );
}
</script>

<template>
  <div class="space-y-4">
    <p
      v-if="!canSelectAnyTeam && !availableTeams.length"
      class="text-sm text-muted-foreground"
    >
      {{ $t("league.join.no_teams") }}
    </p>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1.5">
          <label
            class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
            >{{ $t("league.join.team") }}</label
          >
          <TeamSearch
            v-if="canSelectAnyTeam"
            :label="$t('league.join.pick_team')"
            :my-teams="false"
            :is-admin="false"
            :exclude="registeredTeamIds"
            :model-value="selectedTeamId"
            @selected="selectAnyTeam"
          ></TeamSearch>
          <Select v-else v-model="selectedTeamId">
            <SelectTrigger>
              <SelectValue :placeholder="$t('league.join.pick_team')" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="team in availableTeams"
                  :key="team.id"
                  :value="team.id"
                >
                  {{ team.name }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div
          v-if="allowDivisionRequest || canSelectAnyTeam"
          class="space-y-1.5"
        >
          <label
            class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
            >{{
              canSelectAnyTeam
                ? $t("league.join.assign_division")
                : $t("league.join.requested_division")
            }}</label
          >
          <Select
            :model-value="requestedDivisionId || 'none'"
            @update:model-value="
              (val) =>
                (requestedDivisionId = val === 'none' ? '' : (val as string))
            "
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">
                  {{ $t("league.join.no_preference") }}
                </SelectItem>
                <SelectItem
                  v-for="division in divisions.filter((d) => d.active)"
                  :key="division.id"
                  :value="division.id"
                >
                  {{ division.name }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="space-y-3">
        <RosterSlotPicker
          v-model="assignment"
          :members="members"
          :starters-cap="startersCap"
          :subs-cap="subsCap"
          :disabled="!selectedTeam"
        />

        <p
          v-if="selectedTeam && totalSelected < minRosterSize"
          class="text-xs text-destructive"
        >
          {{ $t("league.join.min_roster_warning", { min: minRosterSize }) }}
        </p>
      </div>

      <Button
        :class="tacticalCtaButtonClasses"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        {{ $t("league.join.register") }}
      </Button>
    </template>
  </div>
</template>
