<script setup lang="ts">
import TournamentTeamMemberRow from "~/components/tournament/TournamentTeamMemberRow.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TournamentTeamInvite from "./TournamentTeamInvite.vue";
import Input from "../ui/input/Input.vue";
import { Button } from "~/components/ui/button";
import {
  MoreHorizontal,
  LogOut,
  Trash,
  UserMinus,
  UserPlus,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
</script>

<template>
  <div v-if="team && e_team_roles" class="flex flex-col gap-4">
    <!-- Team header -->
    <header class="flex items-start justify-between gap-4 flex-wrap">
      <div class="min-w-0 flex-1 flex items-start gap-3">
        <div
          class="shrink-0 h-12 w-12 border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] flex items-center justify-center overflow-hidden"
        >
          <img
            v-if="teamAvatarSrc"
            :src="teamAvatarSrc"
            :alt="team.team?.name || team.name"
            class="h-full w-full object-cover"
          />
          <span
            v-else
            class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
          >
            {{ (team.team?.name || team.name || "?").slice(0, 3) }}
          </span>
        </div>
        <div class="min-w-0 flex-1 flex flex-col gap-2">
          <h2
            class="font-sans text-[1.35rem] font-bold tracking-[0.02em] text-foreground m-0 leading-[1.15]"
          >
            {{ team.team?.name || team.name }}
          </h2>

          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="inline-flex items-center gap-[0.4rem] px-[0.55rem] py-[0.2rem] font-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase border rounded"
              :class="
                team.eligible_at
                  ? 'text-success bg-success/10 border-success/40'
                  : 'text-destructive bg-destructive/10 border-destructive/35'
              "
            >
              <span class="w-[5px] h-[5px] bg-current rounded-full"></span>
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
              class="px-2 py-[0.15rem] font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase text-muted-foreground bg-muted/30 border border-border rounded"
            >
              {{ $t("tournament.team.seed_display", { seed: team.seed }) }}
            </span>

            <label
              v-if="canEditSeed"
              class="inline-flex items-center gap-[0.45rem] font-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-muted-foreground"
            >
              <span>{{ $t("tournament.team.seed_label") }}</span>
              <Input
                type="number"
                min="1"
                placeholder="-"
                class="h-7 w-16"
                :model-value="team.seed ?? ''"
                @update:model-value="onSeedChange"
              />
            </label>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3 flex-shrink-0">
        <div
          class="inline-flex items-baseline gap-[0.2rem] px-[0.7rem] py-[0.35rem] font-mono tabular-nums border border-border rounded bg-muted/20"
        >
          <span class="text-base font-bold text-foreground">
            {{ team.roster.length }}
          </span>
          <span class="text-muted-foreground/50">/</span>
          <span class="text-[0.85rem] text-muted-foreground">
            {{ requiredPlayers }}
          </span>
        </div>

        <DropdownMenu v-if="hasTeamActions">
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
    <div v-if="team.roster" class="flex flex-col gap-[0.85rem]">
      <div
        class="inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.24em] uppercase text-muted-foreground"
      >
        <span class="w-2 h-[2px] bg-[hsl(var(--tac-amber))]"></span>
        {{ $t("common.player") }}
      </div>

      <div class="flex flex-col gap-2">
        <TournamentTeamMemberRow
          v-for="member in team.roster"
          :key="member.id"
          :member="member"
          :team="team"
          :tournament="tournament"
          :roles="e_team_roles"
        />

        <!-- Empty slots -->
        <div
          v-for="slot of Math.max(0, requiredPlayers - team.roster.length)"
          :key="`slot-${slot}`"
          class="flex items-center justify-between gap-3 px-[0.85rem] py-[0.65rem] border border-dashed border-border rounded-md bg-muted/10"
        >
          <div
            class="flex items-center gap-[0.65rem] min-w-0 text-muted-foreground"
          >
            <span
              class="font-mono text-[0.75rem] font-bold tracking-[0.1em] text-muted-foreground/55"
            >
              {{ (slot + team.roster.length).toString().padStart(2, "0") }}
            </span>
            <span class="text-[0.85rem]">
              {{
                $t("tournament.team.slot", {
                  number: slot + team.roster.length,
                })
              }}
            </span>
          </div>
          <div v-if="slot === 1 && team.can_manage" class="flex-shrink-0">
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
        class="mt-2 flex flex-col gap-2"
      >
        <div
          class="inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.24em] uppercase text-muted-foreground/70"
        >
          <span class="w-2 h-[2px] bg-muted-foreground/50"></span>
          {{ $t("tournament.team.pending_invites") }}
          <span
            class="px-[0.4rem] py-[0.02rem] bg-muted/40 text-muted-foreground rounded-full text-[0.6rem]"
          >
            {{ team.invites.length }}
          </span>
        </div>
        <div class="flex flex-col gap-2">
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
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    teamAvatarSrc() {
      const avatarUrl = this.team?.team?.avatar_url;
      if (!avatarUrl) return null;
      return `https://${this.apiDomain}/${avatarUrl}`;
    },
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
