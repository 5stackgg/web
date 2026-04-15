<script setup lang="ts">
import TournamentTeamMemberRow from "~/components/tournament/TournamentTeamMemberRow.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TournamentTeamInvite from "./TournamentTeamInvite.vue";
import Input from "../ui/input/Input.vue";
import { Button } from "~/components/ui/button";
import { MoreHorizontal, LogOut, Trash, UserMinus, UserPlus } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
</script>

<template>
  <div v-if="team && e_team_roles" class="tournament-team">
    <!-- Team header -->
    <header class="tournament-team__header">
      <div class="tournament-team__identity">
        <h2 class="tournament-team__name">
          {{ team.team?.name || team.name }}
        </h2>

        <div class="tournament-team__meta">
          <span
            class="tournament-team__status"
            :class="
              team.eligible_at
                ? 'tournament-team__status--eligible'
                : 'tournament-team__status--pending'
            "
          >
            <span class="tournament-team__status-dot"></span>
            <template v-if="team.eligible_at">
              {{ $t("tournament.team.eligible") }}
            </template>
            <template v-else>
              {{
                $t("tournament.team.not_eligible", {
                  count: requiredPlayers - team.roster.length,
                })
              }}
            </template>
          </span>

          <span
            v-if="!canEditSeed && team.seed"
            class="tournament-team__seed"
          >
            {{ $t("tournament.team.seed_display", { seed: team.seed }) }}
          </span>

          <label
            v-if="canEditSeed"
            class="tournament-team__seed-editor"
          >
            <span>{{ $t("tournament.team.seed_label") }}</span>
            <Input
              type="number"
              min="1"
              class="h-7 w-16"
              :model-value="team.seed ?? ''"
              @update:model-value="onSeedChange"
            />
          </label>
        </div>
      </div>

      <div class="tournament-team__actions">
        <div class="tournament-team__counter">
          <span class="tournament-team__counter-value">
            {{ team.roster.length }}
          </span>
          <span class="tournament-team__counter-divider">/</span>
          <span class="tournament-team__counter-total">
            {{ requiredPlayers }}
          </span>
        </div>

        <DropdownMenu
          v-if="hasTeamActions"
        >
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="icon" class="h-8 w-8">
              <MoreHorizontal class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem
              v-if="!tournament.is_organizer && canLeaveTournament"
              class="text-destructive cursor-pointer"
              @click="leaveTournament"
            >
              <LogOut class="mr-2 h-4 w-4" />
              {{ $t("tournament.team.leave_tournament") }}
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="canLeaveTeam"
              class="text-destructive cursor-pointer"
              @click="leaveTeam"
            >
              <UserMinus class="mr-2 h-4 w-4" />
              {{ $t("tournament.team.leave_team") }}
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="tournament.is_organizer && canRemoveTeam"
              class="text-destructive cursor-pointer"
              @click="removeTeam()"
            >
              <Trash class="mr-2 h-4 w-4" />
              {{ $t("tournament.tournament_team.remove") }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <!-- Roster list -->
    <div v-if="team.roster" class="tournament-team__roster">
      <div class="tournament-team__section-label">
        <span class="tournament-team__tick"></span>
        {{ $t("common.player") }}
      </div>

      <div class="tournament-team__list">
        <TournamentTeamMemberRow
          v-for="member in team.roster"
          :key="member.id"
          :member="member"
          :team="team"
          :roles="e_team_roles"
        />

        <!-- Empty slots -->
        <div
          v-for="slot of Math.max(0, requiredPlayers - team.roster.length)"
          :key="`slot-${slot}`"
          class="tournament-team__slot"
        >
          <div class="tournament-team__slot-label">
            <span class="tournament-team__slot-number">
              {{
                (slot + team.roster.length).toString().padStart(2, "0")
              }}
            </span>
            <span class="tournament-team__slot-text">
              {{
                $t("tournament.team.slot", {
                  number: slot + team.roster.length,
                })
              }}
            </span>
          </div>
          <div v-if="slot === 1 && team.can_manage" class="tournament-team__slot-action">
            <PlayerSearch
              :label="$t('tournament.team.add_player')"
              :self="true"
              :exclude="
                team.roster?.map((member) => member.player.steam_id) || []
              "
              :team-id="team.team_id"
              @selected="addMember"
            />
          </div>
        </div>
      </div>

      <!-- Pending invites -->
      <div
        v-if="team.invites && team.invites.length > 0"
        class="tournament-team__invites"
      >
        <div class="tournament-team__section-label tournament-team__section-label--muted">
          <span class="tournament-team__tick tournament-team__tick--muted"></span>
          {{ $t("tournament.team.pending_invites") }}
          <span class="tournament-team__invite-count">
            {{ team.invites.length }}
          </span>
        </div>
        <div class="tournament-team__list">
          <TournamentTeamInvite
            v-for="invite in team.invites"
            :key="invite.id"
            :invite="invite"
          ></TournamentTeamInvite>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { e_team_roles_enum, e_tournament_status_enum } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    team: {
      type: Object,
      required: true,
    },
    tournament: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    e_team_roles: {
      fetchPolicy: "cache-first",
      query: typedGql("query")({
        e_team_roles: [
          {
            where: {
              value: {
                _nin: [e_team_roles_enum.Invite],
              },
            },
          },
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
  },
  computed: {
    canEditSeed() {
      if (!this.tournament?.is_organizer) return false;
      const status = this.tournament.status;
      return ![
        e_tournament_status_enum.Live,
        e_tournament_status_enum.Finished,
        e_tournament_status_enum.Cancelled,
        e_tournament_status_enum.CancelledMinTeams,
      ].includes(status);
    },
    canLeaveTournament() {
      if (!this.team.can_manage) return false;
      const status = this.tournament.status;
      const restrictedStatuses = [
        e_tournament_status_enum.Cancelled,
        e_tournament_status_enum.CancelledMinTeams,
        e_tournament_status_enum.Finished,
      ];

      // For non-organizers, also restrict Live status
      if (!this.tournament.is_organizer) {
        restrictedStatuses.push(e_tournament_status_enum.Live);
      }

      return !restrictedStatuses.includes(status);
    },
    requiredPlayers() {
      return this.tournament.max_players_per_lineup;
    },
    canLeaveTeam() {
      const isMember =
        this.team.roster.find((member) => {
          return member.player.steam_id === useAuthStore().me?.steam_id;
        }) !== undefined;

      if (!isMember) return false;

      const status = this.tournament.status;
      const restrictedStatuses = [
        e_tournament_status_enum.Cancelled,
        e_tournament_status_enum.CancelledMinTeams,
        e_tournament_status_enum.Finished,
      ];

      // For non-organizers, also restrict Live status
      if (!this.tournament.is_organizer) {
        restrictedStatuses.push(e_tournament_status_enum.Live);
      }

      return !restrictedStatuses.includes(status);
    },
    canRemoveTeam() {
      if (!this.tournament.is_organizer) return false;
      const status = this.tournament.status;
      return ![
        e_tournament_status_enum.Cancelled,
        e_tournament_status_enum.CancelledMinTeams,
        e_tournament_status_enum.Finished,
      ].includes(status);
    },
    hasTeamActions() {
      return (
        (!this.tournament.is_organizer && this.canLeaveTournament) ||
        this.canLeaveTeam ||
        (this.tournament.is_organizer && this.canRemoveTeam)
      );
    },
  },
  methods: {
    async onSeedChange(rawValue: string | number) {
      const stringValue = String(rawValue);
      const value = stringValue.trim() === "" ? null : Number(stringValue);
      if (value !== null && (!Number.isFinite(value) || value < 1)) {
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_tournament_teams_by_pk: [
            {
              pk_columns: {
                id: this.team.id,
              },
              _set: {
                seed: value,
              },
            },
            {
              id: true,
              seed: true,
            },
          ],
        }),
      });
    },
    async cancelInvite() {},
    async leaveTournament() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_teams_by_pk: [
            {
              id: this.team.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async leaveTeam() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_team_roster: [
            {
              where: {
                player_steam_id: {
                  _eq: useAuthStore().me.steam_id,
                },
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async addMember(member) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_team_roster_one: [
            {
              object: {
                player_steam_id: member.steam_id,
                tournament_team_id: this.team.id,
                tournament_id:
                  this.$route.params.tournamentId || this.$route.params.id,
              },
            },
            {
              player_steam_id: true,
            },
          ],
        }),
      });
    },
    async removeTeam() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_teams_by_pk: [
            {
              id: this.team.id,
            },
            {
              id: true,
            },
          ],
        }),
      });
    },
  },
};
</script>

<style scoped>
.tournament-team {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Header */
.tournament-team__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.tournament-team__identity {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.tournament-team__name {
  font-family: "Oxanium", sans-serif;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: hsl(var(--foreground));
  margin: 0;
  line-height: 1.15;
}

.tournament-team__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.tournament-team__status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.55rem;
  font-family: "Oxanium", monospace;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  border: 1px solid;
  border-radius: 0.25rem;
}
.tournament-team__status-dot {
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 9999px;
}
.tournament-team__status--eligible {
  color: hsl(var(--success));
  background: hsl(var(--success) / 0.12);
  border-color: hsl(var(--success) / 0.4);
}
.tournament-team__status--pending {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.1);
  border-color: hsl(var(--destructive) / 0.35);
}

.tournament-team__seed {
  padding: 0.15rem 0.5rem;
  font-family: "Oxanium", monospace;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 0.3);
  border: 1px solid hsl(var(--border));
  border-radius: 0.25rem;
}
.tournament-team__seed-editor {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: "Oxanium", monospace;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.tournament-team__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
.tournament-team__counter {
  display: inline-flex;
  align-items: baseline;
  gap: 0.2rem;
  padding: 0.35rem 0.7rem;
  font-family: "Oxanium", monospace;
  font-variant-numeric: tabular-nums;
  border: 1px solid hsl(var(--border));
  border-radius: 0.25rem;
  background: hsl(var(--muted) / 0.2);
}
.tournament-team__counter-value {
  font-size: 1rem;
  font-weight: 700;
  color: hsl(var(--foreground));
}
.tournament-team__counter-divider {
  color: hsl(var(--muted-foreground) / 0.5);
}
.tournament-team__counter-total {
  font-size: 0.85rem;
  color: hsl(var(--muted-foreground));
}

/* Roster */
.tournament-team__roster {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.tournament-team__section-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: "Oxanium", monospace;
  font-size: 0.65rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.tournament-team__section-label--muted {
  color: hsl(var(--muted-foreground) / 0.7);
}
.tournament-team__tick {
  width: 8px;
  height: 2px;
  background: hsl(var(--tac-amber));
}
.tournament-team__tick--muted {
  background: hsl(var(--muted-foreground) / 0.5);
}

.tournament-team__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Empty slot */
.tournament-team__slot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border: 1px dashed hsl(var(--border));
  border-radius: 0.375rem;
  background: hsl(var(--muted) / 0.1);
}
.tournament-team__slot-label {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  color: hsl(var(--muted-foreground));
}
.tournament-team__slot-number {
  font-family: "Oxanium", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: hsl(var(--muted-foreground) / 0.55);
}
.tournament-team__slot-text {
  font-size: 0.85rem;
}
.tournament-team__slot-action {
  flex-shrink: 0;
}

/* Invites */
.tournament-team__invites {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.tournament-team__invite-count {
  padding: 0.02rem 0.4rem;
  background: hsl(var(--muted) / 0.4);
  color: hsl(var(--muted-foreground));
  border-radius: 9999px;
  font-size: 0.6rem;
}
</style>
