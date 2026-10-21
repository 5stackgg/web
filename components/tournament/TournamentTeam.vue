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
import {
  ChevronRight,
  LogOut,
  Trash2,
  UserMinus,
  UserPlus,
  Pencil,
} from "lucide-vue-next";
import { Switch } from "~/components/ui/switch";
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
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { teamLedgerColumns } from "~/components/tournament/teamLedger";
</script>

<template>
  <div
    v-if="team && e_team_roles"
    class="relative"
    :class="{
      'before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-[3px] before:bg-[hsl(var(--tac-amber))] before:content-[\'\']':
        mine,
    }"
  >
    <!-- The whole row toggles for a pointer; the chevron is the control
         keyboards and screen readers get. -->
    <div
      class="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-muted/20 md:min-h-14 md:gap-4 md:px-4 md:py-2"
      :class="teamLedgerColumns"
      @click="$emit('toggle')"
    >
      <span
        class="hidden font-mono text-sm tabular-nums text-muted-foreground md:block"
      >
        {{ team.seed ?? "–" }}
      </span>

      <span class="flex min-w-0 items-center gap-3">
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)]"
        >
          <img
            v-if="teamAvatarSrc"
            :src="teamAvatarSrc"
            :alt="displayName"
            class="h-full w-full object-cover"
          />
          <span
            v-else
            class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[hsl(var(--tac-amber))]"
          >
            {{ (displayShortName || displayName || "?").slice(0, 4) }}
          </span>
        </span>
        <span class="grid min-w-0 gap-0.5">
          <NuxtLink
            v-if="team.team?.id"
            :to="`/teams/${team.team.id}`"
            class="truncate font-semibold text-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
            @click.stop
          >
            {{ displayName }}
          </NuxtLink>
          <span v-else class="truncate font-semibold text-foreground">
            {{ displayName }}
          </span>
          <span
            class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
          >
            <!-- Without a logo the avatar already shows the tag. -->
            <span
              v-if="displayShortName && teamAvatarSrc"
              class="font-semibold tracking-[0.06em]"
            >
              {{ displayShortName }}
            </span>
            <span
              v-if="mine"
              class="rounded border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] px-1.5 font-semibold text-[hsl(var(--tac-amber))]"
            >
              {{ $t("tournament.page.my_team") }}
            </span>
            <span
              v-if="team.team_id"
              class="rounded border border-border px-1.5 text-foreground"
            >
              {{ $t("tournament.team.kind.team") }}
            </span>
            <span
              v-else
              class="rounded border border-dashed border-muted-foreground/50 px-1.5"
            >
              {{ $t("tournament.team.kind.tournament_only") }}
            </span>
            <!-- Phones fold the status and player count under the name. -->
            <span
              v-if="ledgerStatus"
              class="inline-flex items-center gap-1.5 whitespace-nowrap before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:content-[''] md:hidden"
              :class="statusToneClasses"
            >
              {{ statusLabel }}
              <time
                v-if="checkedInClock"
                class="font-mono text-muted-foreground"
              >
                {{ checkedInClock }}
              </time>
            </span>
            <span class="font-mono tabular-nums md:hidden">
              {{ team.roster.length }}/{{ requiredPlayers }}
            </span>
          </span>
        </span>
      </span>

      <span class="hidden items-center gap-2.5 md:flex">
        <span class="flex items-center">
          <span
            v-for="member in faces"
            :key="member.player.steam_id"
            :title="member.player.name"
            class="-ml-1.5 flex h-[1.375rem] w-[1.375rem] items-center justify-center overflow-hidden rounded-full bg-muted text-[0.6rem] font-bold uppercase text-muted-foreground ring-2 ring-background first:ml-0"
          >
            <img
              v-if="playerAvatarSrc(member.player)"
              :src="playerAvatarSrc(member.player) ?? undefined"
              alt=""
              class="h-full w-full object-cover"
            />
            <template v-else>{{
              (member.player.name || "?").slice(0, 1)
            }}</template>
          </span>
          <span
            v-for="slot in openFaces"
            :key="`open-${slot}`"
            class="-ml-1.5 h-[1.375rem] w-[1.375rem] rounded-full border border-dashed border-muted-foreground/50 bg-background first:ml-0"
          ></span>
        </span>
        <span class="font-mono text-xs tabular-nums text-muted-foreground">
          {{ team.roster.length }}/{{ requiredPlayers }}
        </span>
      </span>

      <span class="hidden min-w-0 md:block">
        <span
          v-if="ledgerStatus"
          data-team-status
          class="inline-flex items-center gap-2 whitespace-nowrap text-sm before:h-[7px] before:w-[7px] before:shrink-0 before:rounded-full before:content-['']"
          :class="statusToneClasses"
        >
          {{ statusLabel }}
          <time
            v-if="checkedInClock"
            class="font-mono text-xs text-muted-foreground"
          >
            {{ checkedInClock }}
          </time>
        </span>
        <span
          v-else-if="finalPlacement"
          class="inline-flex h-6 items-center gap-[0.4rem] px-[0.55rem] font-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase border rounded"
          :style="placementBadgeStyle"
        >
          <span class="w-[5px] h-[5px] bg-current rounded-full"></span>
          {{ ordinal(finalPlacement) }}
        </span>
      </span>

      <span class="flex justify-end" @click.stop>
        <label
          v-if="checkInControl === 'switch'"
          class="inline-flex cursor-pointer items-center gap-2 text-xs font-medium"
          :class="team.checked_in_at ? 'text-success' : 'text-muted-foreground'"
        >
          <Switch
            :model-value="!!team.checked_in_at"
            :aria-label="
              $t('tournament.check_in.present_label', { team: displayName })
            "
            class="data-[state=checked]:bg-success"
            @click.stop
            @update:model-value="(value: boolean) => setCheckIn(value)"
          />
          {{
            team.checked_in_at
              ? $t("tournament.check_in.present")
              : $t("tournament.check_in.absent")
          }}
        </label>
        <Button
          v-else-if="checkInControl === 'readmit'"
          variant="outline"
          size="sm"
          class="h-8"
          @click="readmit"
        >
          <UserPlus class="mr-1.5 h-4 w-4" />
          {{ $t("tournament.check_in_review.readmit") }}
        </Button>
      </span>

      <button
        type="button"
        class="flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground"
        :aria-expanded="expanded"
        :aria-label="
          expanded
            ? $t('tournament.teams_filter.collapse')
            : $t('tournament.teams_filter.expand')
        "
        @click.stop="$emit('toggle')"
      >
        <ChevronRight
          class="h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none"
          :class="{ 'rotate-90': expanded }"
        />
      </button>
    </div>

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

    <Transition name="collapse">
      <div v-if="team.roster && expanded" class="grid grid-rows-[1fr]">
        <div class="overflow-hidden">
          <div
            class="flex flex-col gap-[0.85rem] border-t border-border/60 bg-muted/10 px-3 pb-4 pt-3 md:pl-[4.25rem] md:pr-4"
          >
            <TransitionGroup
              name="roster-row"
              tag="div"
              class="relative flex flex-col divide-y divide-border/50"
            >
              <TournamentTeamMemberRow
                v-for="member in team.roster"
                :key="member.player.steam_id"
                :member="member"
                :team="team"
                :tournament="tournament"
                :roles="e_team_roles"
                :can-leave="canLeaveTeam"
                :roster-locked-at-min="rosterLockedAtMin"
                @leave="leaveTeam"
              />

              <div
                v-for="slot of Math.max(
                  0,
                  requiredPlayers - team.roster.length,
                )"
                :key="`slot-${slot}`"
              >
                <PlayerSearch
                  v-if="team.can_manage"
                  :label="$t('tournament.team.add_player')"
                  :self="true"
                  :ineligible="ineligiblePlayers"
                  :tags="addPlayerTags"
                  :fallback-tag="inviteTag"
                  :hint="inviteHint"
                  :team-id="searchTeamId"
                  @selected="addMember"
                >
                  <button type="button" class="roster-slot roster-slot--open">
                    <span class="roster-slot__avatar">
                      <UserPlus class="h-4 w-4" />
                    </span>
                    <span class="roster-slot__label">
                      {{ $t("tournament.team.add_player") }}
                    </span>
                  </button>
                </PlayerSearch>

                <div v-else class="roster-slot">
                  <span class="roster-slot__avatar"></span>
                  <span class="roster-slot__label">
                    {{
                      $t("tournament.team.slot", {
                        number: slot + team.roster.length,
                      })
                    }}
                  </span>
                </div>
              </div>
            </TransitionGroup>

            <div
              v-if="team.invites && team.invites.length > 0"
              class="flex flex-col gap-1"
            >
              <div class="text-xs text-muted-foreground">
                {{ $t("tournament.team.pending_invites") }}
                <span class="tabular-nums">· {{ team.invites.length }}</span>
              </div>
              <TransitionGroup
                name="roster-row"
                tag="div"
                class="relative flex flex-col divide-y divide-border/50"
              >
                <TournamentTeamInvite
                  v-for="invite in team.invites"
                  :key="invite.id"
                  :invite="invite"
                  :joins-team="!!team.team_id"
                ></TournamentTeamInvite>
              </TransitionGroup>
            </div>

            <div v-if="hasRowTools" class="flex flex-wrap items-center gap-2">
              <Popover
                v-if="canEditIdentity"
                v-model:open="isEditingIdentity"
                @update:open="onIdentityPopoverToggle"
              >
                <PopoverTrigger as-child>
                  <Button variant="outline" size="sm" class="h-8">
                    <Pencil class="mr-1.5 h-4 w-4" />
                    {{ $t("common.actions.edit") }}
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

              <label
                v-if="canEditSeed"
                class="group/seed inline-flex h-8 items-center overflow-hidden rounded border border-border bg-muted/30 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-foreground transition-colors focus-within:border-[hsl(var(--tac-amber)/0.6)] hover:border-[hsl(var(--tac-amber)/0.4)]"
              >
                <span class="pl-2 pr-[0.45rem]">
                  {{ $t("tournament.team.seed_label") }}
                </span>
                <input
                  type="number"
                  min="1"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="—"
                  class="seed-input h-full w-9 border-l border-border bg-transparent text-center font-mono text-[0.7rem] font-bold tabular-nums text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 group-focus-within/seed:border-[hsl(var(--tac-amber)/0.6)]"
                  :value="team.seed ?? ''"
                  @input="
                    onSeedChange(($event.target as HTMLInputElement).value)
                  "
                />
              </label>

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
                size="sm"
                class="ml-auto h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                @click="removeTeamDialog = true"
              >
                <Trash2 class="mr-1.5 h-4 w-4" />
                {{ $t("tournament.tournament_team.remove") }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts">
import {
  $,
  e_team_roles_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { tournamentPodiumQuery } from "~/graphql/tournamentPodium";
import { playerBlockErrorKey } from "~/utilities/playerBlocks";
import { dateLocale } from "~/utilities/dateLocale";
import { teamLedgerStatus } from "~/components/tournament/teamLedger";

export default {
  emits: ["toggle"],
  props: {
    team: {
      type: Object,
      required: true,
    },
    tournament: {
      type: Object,
      required: true,
    },
    expanded: {
      type: Boolean,
      default: false,
    },
    // One of the viewer's own entries: pinned first and marked in the row.
    mine: {
      type: Boolean,
      default: false,
    },
    freeAgentSteamIds: {
      type: Array as () => Array<string>,
      default: () => [],
    },
    registration: {
      type: Object,
      default: null,
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
      podiumSteps: null as any[] | null,
      teamMemberSteamIds: [] as string[],
    };
  },
  apollo: {
    // Who is already on a team-backed entry's team: they go straight onto the
    // lineup, everyone else gets an invite to the team.
    teamMemberSteamIds: {
      fetchPolicy: "cache-and-network",
      query: typedGql("query")({
        team_roster: [
          { where: { team_id: { _eq: $("team_id", "uuid!") } } },
          { player_steam_id: true },
        ],
      }),
      variables: function () {
        return { team_id: (this as any).team?.team_id };
      },
      skip: function () {
        const self = this as any;
        return !self.team?.team_id || !self.team?.can_manage;
      },
      update: (data: any) =>
        (data?.team_roster ?? []).map((row: any) =>
          String(row.player_steam_id),
        ),
    },
    // The placements the podium shows, where a shared 3rd is two teams on
    // the same step. Optional, so an api without the field falls back.
    podiumSteps: {
      fetchPolicy: "cache-first",
      query: tournamentPodiumQuery,
      variables: function () {
        return { tournamentId: (this as any).tournament?.id };
      },
      skip: function () {
        const self = this as any;
        return (
          !self.tournament?.id ||
          self.tournament?.status !== e_tournament_status_enum.Finished
        );
      },
      update: (data: any) => data?.tournaments_by_pk?.podium ?? null,
      context: { optional: true },
      error: () => {},
    },
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
      return resolveAvatarUrl(avatarUrl, this.apiDomain, 128);
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
    freeAgentTags() {
      const tag = this.$t("tournament.team.free_agent_tag");
      return Object.fromEntries(
        this.freeAgentSteamIds.map((steamId) => [steamId, tag]),
      );
    },
    // tbi_tournament_team_roster: staff roles place anyone outright, and a
    // tournament's own organizers do so on a team-backed entry; on a
    // tournament-only team their pick is an invite like anyone else's.
    placesOutright() {
      const auth = useAuthStore();
      return (
        auth.isAdmin ||
        auth.isTournamentOrganizer ||
        (!!this.team.team_id && !!this.tournament.is_organizer)
      );
    },
    invitesOutsiders() {
      return !this.placesOutright && !!this.team.can_recruit;
    },
    // Without can_recruit, a team-backed lineup is picked from the team alone.
    searchTeamId() {
      return this.team.team_id && !this.placesOutright && !this.team.can_recruit
        ? this.team.team_id
        : undefined;
    },
    addPlayerTags() {
      const onTeam = this.$t("tournament.team.add_tag.on_team");
      return {
        ...Object.fromEntries(
          this.teamMemberSteamIds.map((steamId) => [steamId, onTeam]),
        ),
        ...(this.placesOutright ? {} : this.freeAgentTags),
      };
    },
    // tbi_tournament_team_roster places an organizer's pick outright; anyone
    // else's becomes an invite, to the team as well when the entry has one.
    inviteTag() {
      if (!this.invitesOutsiders) {
        return undefined;
      }
      return this.team.team_id
        ? this.$t("tournament.team.add_tag.team_invite")
        : this.$t("tournament.team.add_tag.tournament_invite");
    },
    inviteHint() {
      if (!this.invitesOutsiders) {
        return undefined;
      }
      return this.team.team_id
        ? this.$t("tournament.team.add_hint.team", { team: this.displayName })
        : this.$t("tournament.team.add_hint.tournament", {
            team: this.displayName,
          });
    },
    // Layered so the most specific fact wins: another team's roster first,
    // then this team's roster, then this team's pending invites.
    //
    // Pending invites on OTHER teams can't be included — tournament_team_invites
    // is only selectable for your own team (see the note in TournamentDetail's
    // visibleTeams), so those players still look selectable and fail on insert.
    // addMember maps that error to a specific toast.
    ineligiblePlayers() {
      const map = {};

      for (const other of this.tournament.teams || []) {
        if (other.id === this.team.id) {
          continue;
        }
        for (const member of other.roster || []) {
          if (member.player?.steam_id) {
            map[String(member.player.steam_id)] = this.$t(
              "tournament.team.ineligible.on_other_team",
              { team: other.name },
            );
          }
        }
      }

      for (const member of this.team.roster || []) {
        if (member.player?.steam_id) {
          map[String(member.player.steam_id)] = this.$t(
            "tournament.team.ineligible.on_this_roster",
          );
        }
      }

      for (const invite of this.team.invites || []) {
        if (invite.player?.steam_id) {
          map[String(invite.player.steam_id)] = this.$t(
            "tournament.team.ineligible.invite_pending",
          );
        }
      }

      return map;
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
    ledgerStatus() {
      return teamLedgerStatus(this.team, this.tournament, this.registration);
    },
    statusLabel() {
      const status = this.ledgerStatus;
      switch (status?.key) {
        case "short":
          return this.$t(
            "tournament.team.status.needs_players",
            { count: status.count },
            status.count,
          );
        case "ready":
          return this.$t("tournament.team.status.ready");
        case "not_eligible":
          return this.$t("tournament.team.status.not_eligible");
        case "in":
          return this.$t("tournament.team.status.checked_in");
        case "miss":
          return this.$t("tournament.team.status.missed");
        case "wait":
          // Every-player mode is waiting on people, not on a captain: say how
          // many of the lineup have confirmed.
          if (this.registration?.check_in_setting === "Players") {
            return this.$t("tournament.check_in.players_progress", {
              checked: this.team.roster.filter(
                (member: Record<string, any>) => !!member.checked_in_at,
              ).length,
              required: this.minPlayers,
            });
          }
          return this.$t("tournament.team.status.not_checked_in");
      }
      return "";
    },
    statusToneClasses() {
      switch (this.ledgerStatus?.key) {
        case "in":
        case "ready":
          return "text-success before:bg-current";
        case "wait":
          return "text-[hsl(var(--tac-amber))] before:bg-current";
        case "miss":
        case "not_eligible":
          return "text-destructive before:bg-current";
      }
      return "text-muted-foreground before:border before:border-current";
    },
    checkedInClock() {
      const status = this.ledgerStatus;
      if (status?.key !== "in") {
        return null;
      }
      return new Date(status.at).toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    // During the window an organizer flips a team present or absent without
    // re-seeding; afterwards a missed team comes back through a re-admit.
    checkInControl(): "switch" | "readmit" | null {
      if (!this.tournament.is_organizer) {
        return null;
      }
      const key = this.ledgerStatus?.key;
      if (
        this.registration?.check_in_open &&
        (key === "wait" || key === "in")
      ) {
        return "switch";
      }
      return key === "miss" ? "readmit" : null;
    },
    faces() {
      return this.team.roster.slice(
        0,
        this.minPlayers || this.team.roster.length,
      );
    },
    openFaces() {
      return Math.max(0, this.minPlayers - this.team.roster.length);
    },
    hasRowTools() {
      return (
        this.canEditIdentity ||
        this.canEditSeed ||
        (!this.tournament.is_organizer && this.canLeaveTournament) ||
        (this.tournament.is_organizer && this.canRemoveTeam)
      );
    },
    finalPlacement() {
      if (this.tournament.status !== e_tournament_status_enum.Finished) {
        return null;
      }
      const step = ((this.podiumSteps as any[]) || []).find(
        (s: any) =>
          s?.tournament_team_id === this.team.id && Number(s.placement) > 0,
      );
      if (step) {
        return Number(step.placement);
      }
      const awards = (this.tournament as any).awards || [];
      const award = awards.find(
        (t: any) =>
          t.tournament_team_id === this.team.id && Number(t.placement) > 0,
      );
      if (award) return Number(award.placement);

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
    playerAvatarSrc(player: Record<string, any>) {
      return resolveAvatarUrl(
        player.custom_avatar_url || player.avatar_url,
        this.apiDomain,
        64,
      );
    },
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
                tournament_team_id: {
                  _eq: this.team.id,
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
      try {
        const result = await this.$apollo.mutate({
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

        // tbi_tournament_team_roster swallows the insert and raises an invite
        // instead unless the session can add players outright, so a null row
        // means "invited", not "failed".
        const added = Boolean(
          result.data?.insert_tournament_team_roster_one?.player_steam_id,
        );

        toast({
          title: added
            ? this.$t("tournament.team.member_added")
            : this.$t("tournament.team.invite_sent"),
          description: added
            ? this.$t("tournament.team.member_added_description", {
                name: member.name,
              })
            : this.team.team_id
              ? this.$t("tournament.team.invite_sent_team_description", {
                  name: member.name,
                  team: this.displayName,
                })
              : this.$t("tournament.team.invite_sent_tournament_description", {
                  name: member.name,
                  team: this.displayName,
                }),
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        // The trigger rejects anyone already in the tournament. We dim the
        // ones we can see, but pending invites on other teams aren't readable
        // from here, so that case only surfaces as this error.
        const alreadyInTournament = /already.*(tournament|team)/i.test(message);
        const blockedKey = playerBlockErrorKey(message);

        toast({
          title: this.$t("tournament.team.add_player"),
          description: alreadyInTournament
            ? this.$t("tournament.team.already_in_tournament")
            : blockedKey
              ? this.$t(blockedKey)
              : message,
          variant: "destructive",
        });
      }
    },
    // Organizers set it in every mode while the window is open; no re-seed, so
    // the teams still confirming keep their place.
    async setCheckIn(checkedIn: boolean) {
      try {
        await this.$apollo.mutate({
          // The action ships with the api change; zeus only types it after
          // `yarn codegen` has run against that schema.
          mutation: generateMutation({
            setTournamentTeamCheckIn: [
              {
                tournament_id: this.tournament.id,
                tournament_team_id: this.team.id,
                checked_in: checkedIn,
              },
              { success: true },
            ],
          } as any),
        });
      } catch (error: unknown) {
        toast({
          title: checkedIn
            ? this.$t("tournament.check_in.failed")
            : this.$t("tournament.check_in.undo_failed"),
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
      }
    },
    // After the window, a missed team comes back the way the review does it:
    // stamped and re-seeded.
    async readmit() {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            readmitTournamentTeam: [
              {
                tournament_id: this.tournament.id,
                tournament_team_id: this.team.id,
              },
              { success: true },
            ],
          }),
        });
      } catch (error: unknown) {
        toast({
          title: this.$t("tournament.check_in_review.readmit_failed"),
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
      }
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

<style scoped>
/* Sized to a filled roster row: PlayerDisplay's compact 32px avatar plus
   the row's vertical padding. */
.roster-slot {
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.65rem;
  padding: 0.375rem 0;
  color: hsl(var(--muted-foreground));
  transition: color 0.16s ease;
}
.roster-slot--open {
  cursor: pointer;
  text-align: left;
}
.roster-slot--open:hover {
  color: hsl(var(--tac-amber));
}
.roster-slot__avatar {
  display: grid;
  place-items: center;
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  border: 1px dashed hsl(var(--border));
  border-radius: 0.375rem;
  transition: border-color 0.16s ease;
}
.roster-slot--open:hover .roster-slot__avatar {
  border-color: hsl(var(--tac-amber) / 0.5);
}
.roster-slot__label {
  font-size: 0.85rem;
}

.roster-row-move,
.roster-row-enter-active,
.roster-row-leave-active {
  transition: all 0.25s ease;
}
.roster-row-enter-from,
.roster-row-leave-to {
  opacity: 0;
  transform: translateX(0.5rem);
}
.roster-row-leave-active {
  position: absolute;
  width: 100%;
}

/* The native number spinners crowd a 24px-tall field and only appear on hover,
   which made the seed box jump width. Seed is typed, not stepped. */
.seed-input::-webkit-outer-spin-button,
.seed-input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.seed-input {
  appearance: textfield;
  -moz-appearance: textfield;
}

/* Height-collapse for the roster body, matching the grid-template-rows pattern
   used elsewhere (MatchOptions, TournamentAwardsManage) so collapsing a team
   never snaps the cards below it. */
.collapse-enter-active,
.collapse-leave-active {
  transition:
    grid-template-rows 260ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms ease;
}

.collapse-enter-from,
.collapse-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .collapse-enter-active,
  .collapse-leave-active {
    transition: none;
  }
}
</style>
