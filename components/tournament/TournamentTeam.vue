<script setup lang="ts">
import TournamentTeamMemberRow from "~/components/tournament/TournamentTeamMemberRow.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TournamentTeamInvite from "./TournamentTeamInvite.vue";
import Input from "../ui/input/Input.vue";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Label } from "~/components/ui/label";
import { LogOut, Trash2, UserMinus, UserPlus, Pencil } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { toast } from "~/components/ui/toast";
</script>

<template>
  <div v-if="team && e_team_roles" class="flex flex-col gap-4">
    <header class="flex items-start justify-between gap-4 flex-wrap">
      <div class="min-w-0 flex-1 flex items-start gap-3">
        <div
          class="shrink-0 h-12 w-12 border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] flex items-center justify-center overflow-hidden"
        >
          <img
            v-if="teamAvatarSrc"
            :src="teamAvatarSrc"
            :alt="displayName"
            class="h-full w-full object-cover"
          />
          <span
            v-else
            class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
          >
            {{ (displayShortName || displayName || "?").slice(0, 3) }}
          </span>
        </div>
        <div class="min-w-0 flex-1 flex flex-col gap-2">
          <h2
            class="group/identity font-sans text-[1.35rem] font-bold tracking-[0.02em] text-foreground m-0 leading-[1.15] flex items-center gap-2"
          >
            <NuxtLink
              v-if="team.team?.id"
              :to="`/teams/${team.team.id}`"
              class="hover:text-[hsl(var(--tac-amber))] transition-colors"
            >
              {{ displayName }}
            </NuxtLink>
            <template v-else>
              {{ displayName }}
            </template>
            <span
              v-if="displayShortName"
              class="px-2 py-[0.1rem] font-mono text-[0.7rem] font-bold tracking-[0.18em] uppercase text-muted-foreground bg-muted/30 border border-border rounded"
            >
              {{ displayShortName }}
            </span>
            <Popover
              v-if="canEditIdentity"
              v-model:open="isEditingIdentity"
              @update:open="onIdentityPopoverToggle"
            >
              <PopoverTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 text-muted-foreground hover:text-[hsl(var(--tac-amber))] opacity-0 group-hover/identity:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 data-[state=open]:text-[hsl(var(--tac-amber))] transition-opacity"
                  :title="$t('common.actions.edit')"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                :side-offset="8"
                class="w-[320px] p-0"
                @open-auto-focus="onIdentityPopoverOpenAutoFocus"
                @escape-key-down="cancelEditIdentity"
              >
                <form
                  class="flex flex-col gap-3 p-4"
                  @submit.prevent="saveIdentity"
                >
                  <div
                    class="inline-flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    <span
                      class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
                    ></span>
                    {{ $t("team.form.identity") }}
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <Label
                      for="tournament-team-name"
                      class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      {{ $t("common.team_name") }}
                    </Label>
                    <Input
                      id="tournament-team-name"
                      ref="nameInput"
                      v-model="editName"
                      :placeholder="$t('team.form.name_placeholder')"
                      maxlength="40"
                      :disabled="savingIdentity"
                      class="h-9"
                      @keydown.enter.prevent="saveIdentity"
                    />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <Label
                      for="tournament-team-tag"
                      class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      {{ $t("team.form.short_name") }}
                    </Label>
                    <Input
                      id="tournament-team-tag"
                      v-model="editShortName"
                      :placeholder="$t('team.form.short_name')"
                      maxlength="5"
                      :disabled="savingIdentity"
                      class="h-9 uppercase tracking-[0.18em] font-mono"
                      @input="onShortNameInput"
                      @keydown.enter.prevent="saveIdentity"
                    />
                  </div>

                  <p
                    v-if="identityError"
                    class="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-destructive"
                  >
                    {{ identityError }}
                  </p>

                  <div class="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      :disabled="savingIdentity"
                      @click="cancelEditIdentity"
                    >
                      {{ $t("common.cancel") }}
                    </Button>
                    <Button
                      variant="tactical"
                      type="submit"
                      size="sm"
                      :disabled="!canSaveIdentity"
                      :loading="savingIdentity"
                    >
                      <Spinner v-if="savingIdentity" class="mr-1 h-4 w-4" />
                      {{ $t("common.save") }}
                    </Button>
                  </div>
                </form>
              </PopoverContent>
            </Popover>
          </h2>

          <div class="flex items-center gap-2 flex-wrap">
            <span
              v-if="finalPlacement"
              class="inline-flex items-center gap-[0.4rem] px-[0.55rem] py-[0.2rem] font-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase border rounded"
              :style="placementBadgeStyle"
            >
              <span class="w-[5px] h-[5px] bg-current rounded-full"></span>
              {{ ordinal(finalPlacement) }}
            </span>

            <span
              v-if="showEligibilityBadge"
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

        <Button
          v-if="!tournament.is_organizer && canLeaveTournament"
          variant="outline"
          size="sm"
          class="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          @click="leaveTournament"
        >
          <LogOut class="mr-1.5 h-4 w-4" />
          {{ $t("tournament.team.leave_tournament") }}
        </Button>

        <Button
          v-if="tournament.is_organizer && canRemoveTeam"
          variant="outline"
          size="icon"
          class="h-8 w-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          :title="$t('tournament.tournament_team.remove')"
          @click="removeTeamDialog = true"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    </header>

    <AlertDialog
      :open="removeTeamDialog"
      @update:open="(open) => (removeTeamDialog = open)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("tournament.tournament_team.remove") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{
              $t("tournament.tournament_team.confirm_remove", {
                name: displayName,
              })
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="removeTeam"
          >
            {{ $t("tournament.tournament_team.remove") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
          :can-leave="canLeaveTeam"
          :roster-locked-at-min="rosterLockedAtMin"
          @leave="leaveTeam"
        />

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
  data() {
    return {
      isEditingIdentity: false,
      editName: "",
      editShortName: "",
      savingIdentity: false,
      identityError: "",
      removeTeamDialog: false,
    };
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
    displayName() {
      return this.team.team?.name || this.team.name || "";
    },
    displayShortName() {
      return this.team.team?.short_name || this.team.short_name || "";
    },
    canEditIdentity() {
      if (this.team.team_id) return false;
      const status = this.tournament.status;
      const blocked = [
        e_tournament_status_enum.Finished,
        e_tournament_status_enum.Cancelled,
        e_tournament_status_enum.CancelledMinTeams,
      ];
      if (blocked.includes(status)) return false;
      return this.tournament.is_organizer || this.team.can_manage;
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

      if (!this.tournament.is_organizer) {
        restrictedStatuses.push(e_tournament_status_enum.Live);
      }

      return !restrictedStatuses.includes(status);
    },
    requiredPlayers() {
      return this.tournament.max_players_per_lineup;
    },
    minPlayers() {
      return this.tournament.min_players_per_lineup;
    },
    rosterLocked() {
      // Once the bracket has been seeded the roster is locked to its minimum;
      // dropping below it strips the team's eligibility and seed mid-tournament.
      return [
        e_tournament_status_enum.RegistrationClosed,
        e_tournament_status_enum.Live,
        e_tournament_status_enum.Paused,
      ].includes(this.tournament.status);
    },
    rosterLockedAtMin() {
      return this.rosterLocked && this.team.roster.length <= this.minPlayers;
    },
    trimmedEditName() {
      return (this.editName || "").trim();
    },
    trimmedEditShortName() {
      return (this.editShortName || "").trim();
    },
    identityHasChanges() {
      const currentName = this.team.name || "";
      const currentShort = this.team.short_name || "";
      return (
        this.trimmedEditName !== currentName ||
        this.trimmedEditShortName !== currentShort
      );
    },
    canSaveIdentity() {
      if (this.savingIdentity) return false;
      if (this.trimmedEditName.length < 1) return false;
      if (this.trimmedEditShortName.length > 5) return false;
      return this.identityHasChanges;
    },
    canLeaveTeam() {
      const isMember =
        this.team.roster.find((member) => {
          return member.player.steam_id === useAuthStore().me?.steam_id;
        }) !== undefined;

      if (!isMember) return false;

      // Leaving would drop a seeded roster below the minimum lineup.
      if (this.rosterLockedAtMin) return false;

      const status = this.tournament.status;
      const restrictedStatuses = [
        e_tournament_status_enum.Cancelled,
        e_tournament_status_enum.CancelledMinTeams,
        e_tournament_status_enum.Finished,
      ];

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
    hasStarted() {
      const status = this.tournament.status;
      return ![
        e_tournament_status_enum.Setup,
        e_tournament_status_enum.RegistrationOpen,
        e_tournament_status_enum.RegistrationClosed,
      ].includes(status);
    },
    showEligibilityBadge() {
      return !this.hasStarted;
    },
    finalPlacement() {
      if (this.tournament.status !== e_tournament_status_enum.Finished) {
        return null;
      }
      const trophies = (this.tournament as any).trophies || [];
      const trophy = trophies.find(
        (t: any) =>
          t.tournament_team_id === this.team.id && Number(t.placement) > 0,
      );
      if (trophy) return Number(trophy.placement);

      const stages = ((this.tournament as any).stages || [])
        .slice()
        .sort(
          (a: any, b: any) => (Number(b.order) || 0) - (Number(a.order) || 0),
        );
      for (const stage of stages) {
        const result = (stage.results || []).find(
          (r: any) => r.tournament_team_id === this.team.id,
        );
        if (result?.placement) return Number(result.placement);
        if (result?.rank) return Number(result.rank);
      }
      return null;
    },
    placementBadgeStyle() {
      const p = this.finalPlacement;
      if (p === 1) {
        return {
          color: "hsl(45 95% 60%)",
          borderColor: "hsl(45 95% 60% / 0.45)",
          background: "hsl(45 95% 60% / 0.12)",
        };
      }
      if (p === 2) {
        return {
          color: "hsl(0 0% 78%)",
          borderColor: "hsl(0 0% 78% / 0.45)",
          background: "hsl(0 0% 78% / 0.12)",
        };
      }
      if (p === 3) {
        return {
          color: "hsl(28 70% 52%)",
          borderColor: "hsl(28 70% 52% / 0.45)",
          background: "hsl(28 70% 52% / 0.12)",
        };
      }
      return {
        color: "hsl(var(--muted-foreground))",
        borderColor: "hsl(var(--border))",
        background: "hsl(var(--muted) / 0.3)",
      };
    },
  },
  methods: {
    ordinal(n: number) {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },
    onIdentityPopoverToggle(open: boolean) {
      if (open) {
        this.editName = this.team.name || "";
        this.editShortName = (this.team.short_name || "").toUpperCase();
        this.identityError = "";
        return;
      }
      if (this.savingIdentity) return;
      this.editName = "";
      this.editShortName = "";
      this.identityError = "";
    },
    onIdentityPopoverOpenAutoFocus(event: Event) {
      event.preventDefault();
      const input = this.$refs.nameInput as
        | { $el?: HTMLInputElement }
        | undefined;
      const el = input?.$el;
      if (el && typeof el.focus === "function") {
        el.focus();
        el.select?.();
      }
    },
    cancelEditIdentity() {
      if (this.savingIdentity) return;
      this.isEditingIdentity = false;
    },
    onShortNameInput(event: Event) {
      const target = event.target as HTMLInputElement | null;
      if (!target) return;
      const upper = target.value.toUpperCase();
      if (target.value !== upper) {
        target.value = upper;
      }
      this.editShortName = upper;
    },
    async saveIdentity() {
      if (!this.canSaveIdentity) return;

      const name = this.trimmedEditName;
      const shortName = this.trimmedEditShortName;

      this.savingIdentity = true;
      this.identityError = "";
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_tournament_teams_by_pk: [
              {
                pk_columns: {
                  id: this.team.id,
                },
                _set: {
                  name,
                  short_name: shortName || null,
                },
              },
              {
                id: true,
                name: true,
                short_name: true,
              },
            ],
          }),
        });

        this.isEditingIdentity = false;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error ?? "");
        this.identityError = message || this.$t("common.error");
      } finally {
        this.savingIdentity = false;
      }
    },
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
      this.removeTeamDialog = false;
      try {
        const result = await this.$apollo.mutate({
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

        if (!result.data?.delete_tournament_teams_by_pk?.id) {
          throw new Error("Delete returned no row — permission denied?");
        }

        toast({
          title: this.$t("tournament.tournament_team.remove"),
          description: this.displayName,
        });
      } catch (error: unknown) {
        console.error("removeTeam failed", error);
        toast({
          title: this.$t("tournament.tournament_team.remove"),
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
      }
    },
  },
};
</script>
