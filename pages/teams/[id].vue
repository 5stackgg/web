<script setup lang="ts">
import { TeamMembers } from "~/components/teams";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { ref } from "vue";
import { MoreVertical, Trash2, LogOut, Pencil } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TeamForm from "~/components/teams/TeamForm.vue";
import MatchesTable from "~/components/MatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
import TrophyCase from "~/components/trophy/TrophyCase.vue";
import TeamCareerStats from "~/components/team/TeamCareerStats.vue";
import TeamVetoStats from "~/components/team/TeamVetoStats.vue";
import TeamVetoSimulator from "~/components/team/TeamVetoSimulator.vue";
import TeamRankSummary from "~/components/team/TeamRankSummary.vue";
import TeamHighlights from "~/components/team/TeamHighlights.vue";
import TeamLeagueHistory from "~/components/teams/TeamLeagueHistory.vue";
import TeamScrimManager from "~/components/team/TeamScrimManager.vue";
import TeamCalendarButton from "~/components/team/TeamCalendarButton.vue";
import ScrimRequestDialog from "~/components/team/ScrimRequestDialog.vue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";

const teamMenu = ref(false);
const teamHeroClasses =
  "relative rounded-lg border border-border px-5 py-4 sm:px-6 sm:py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.55)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']";
const teamHeroBodyClasses = "flex flex-wrap items-center gap-7 max-md:gap-4";
const teamHeroEmblemFrameClasses =
  "relative flex h-[140px] w-[140px] items-center justify-center border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] p-1 max-md:h-24 max-md:w-24";
const teamHeroEmblemClasses =
  "font-sans font-bold uppercase tracking-[0.05em] text-[hsl(var(--tac-amber))] text-[2.5rem] max-md:text-[1.75rem] leading-none";
const teamHeroEmblemCornerClasses =
  "absolute h-3 w-3 border-[hsl(var(--tac-amber))]";
const teamHeroIdentityClasses = "flex min-w-0 flex-1 flex-col gap-3";
const teamHeroNameRowClasses = "flex min-w-0 flex-wrap items-center gap-3";
const teamHeroNameClasses =
  "relative m-0 min-w-0 truncate font-sans text-[clamp(1.6rem,3.2vw,2.5rem)] font-bold uppercase leading-tight tracking-[0.02em] text-foreground [font-stretch:80%]";
const teamHeroTagClasses =
  "inline-flex items-center border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] px-[0.65rem] py-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]";
const teamHeroMetaClasses = "inline-flex flex-wrap items-center gap-[0.65rem]";
const teamHeroMetaLabelClasses =
  "font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground";
const teamHeroStatsClasses = "mt-[0.15rem] inline-flex items-center gap-5";
const teamHeroStatClasses = "inline-flex items-baseline gap-1.5";
const teamHeroStatValueClasses =
  "font-sans text-xl font-bold tabular-nums text-foreground";
const teamHeroStatLabelClasses =
  "font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground";
const teamHeroStatDividerClasses = "h-5 w-px bg-border";
const teamHeroActionsClasses =
  "ml-auto flex shrink-0 items-center gap-3 max-md:ml-0";
</script>

<template>
  <PageTransition v-if="team">
    <header :class="teamHeroClasses">
      <div :class="teamHeroBodyClasses">
        <div :class="teamHeroEmblemFrameClasses">
          <img
            v-if="teamAvatarSrc"
            :src="teamAvatarSrc"
            :alt="team.name"
            class="h-full w-full object-cover"
          />
          <span v-else :class="teamHeroEmblemClasses">
            {{ team.short_name || team.name }}
          </span>
          <div
            :class="[
              teamHeroEmblemCornerClasses,
              '-left-[2px] -top-[2px] border-l-2 border-t-2',
            ]"
          ></div>
          <div
            :class="[
              teamHeroEmblemCornerClasses,
              '-bottom-[2px] -right-[2px] border-b-2 border-r-2',
            ]"
          ></div>
        </div>

        <div :class="teamHeroIdentityClasses">
          <div :class="teamHeroNameRowClasses">
            <h1 :class="teamHeroNameClasses">{{ team.name }}</h1>
            <span v-if="team.short_name" :class="teamHeroTagClasses">
              {{ team.short_name }}
            </span>
            <TeamRankSummary
              :ranks="team.ranks"
              :reputation="team.reputation"
            />
          </div>

          <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div :class="teamHeroMetaClasses">
              <span :class="teamHeroMetaLabelClasses">
                {{ $t("team.roles.captain") }}
              </span>
              <PlayerDisplay
                :player="teamCaptain"
                :linkable="true"
                size="sm"
                :avatar-override="teamCaptainRosterImageSrc"
              />
            </div>

            <span class="hidden sm:inline-block h-5 w-px bg-border"></span>

            <div class="inline-flex items-center gap-5">
              <div :class="teamHeroStatClasses">
                <span :class="teamHeroStatValueClasses">{{
                  team.roster?.length || 0
                }}</span>
                <span :class="teamHeroStatLabelClasses">{{
                  $t("team.hero.roster")
                }}</span>
              </div>
              <span :class="teamHeroStatDividerClasses"></span>
              <div :class="teamHeroStatClasses">
                <span :class="teamHeroStatValueClasses">{{
                  teamMatches.length
                }}</span>
                <span :class="teamHeroStatLabelClasses">{{
                  $t("team.hero.matches")
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <div :class="teamHeroActionsClasses">
          <DropdownMenu v-model:open="teamMenu" v-if="isOnTeam || isAdmin">
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="icon">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-[200px]">
              <DropdownMenuGroup>
                <template
                  v-if="isAdmin || team.owner.steam_id === me?.steam_id"
                >
                  <DropdownMenuItem @click="editTeamSheet = true">
                    <Pencil />
                    {{ $t("common.actions.edit") }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    class="text-destructive focus:text-destructive"
                    @click="deleteTeamAlertDialog = true"
                  >
                    <Trash2 />
                    {{ $t("common.actions.delete") }}
                  </DropdownMenuItem>
                </template>
                <template v-if="isOnTeam">
                  <DropdownMenuItem
                    class="text-destructive focus:text-destructive"
                    @click="leaveTeamAlertDialog = true"
                  >
                    <LogOut />
                    {{ $t("team.leave") }}
                  </DropdownMenuItem>
                </template>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  </PageTransition>

  <PageTransition
    :delay="50"
    v-if="teamTrophies && teamTrophies.length > 0"
    class="mt-6"
  >
    <TrophyCase :trophies="teamTrophies" :hide-mvp="true" />
  </PageTransition>

  <Tabs v-if="team" v-model="tab" class="mt-6 w-full">
    <TabsList variant="default" class="flex-wrap justify-start">
      <TabsTrigger value="overview">{{ $t("team.tabs.overview") }}</TabsTrigger>
      <TabsTrigger value="stats">{{ $t("team.tabs.stats") }}</TabsTrigger>
      <TabsTrigger value="highlights">{{
        $t("team.tabs.highlights")
      }}</TabsTrigger>
      <TabsTrigger v-if="showScrimTab" value="scrim">
        {{ $t("team.tabs.scrim") }}
      </TabsTrigger>
    </TabsList>
  </Tabs>

  <Transition
    v-if="team"
    mode="out-in"
    enter-active-class="transition-[opacity,transform] duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-3"
    leave-active-class="transition-[opacity,transform] duration-150 ease-in"
    leave-to-class="opacity-0 -translate-y-3"
  >
    <div :key="tab" class="mt-6">
      <div
        v-if="tab === 'overview'"
        class="grid grid-cols-1 items-start gap-6 lg:grid-cols-5"
      >
        <div class="space-y-6 lg:col-span-2">
          <TeamLeagueHistory :team-id="String($route.params.id)" />
          <TeamMembers :team-id="$route.params.id" />
        </div>
        <div class="space-y-3 lg:col-span-3">
          <div class="flex items-center justify-between gap-4">
            <span :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("match.recent.title") }}
            </span>
            <TeamCalendarButton :team-id="String($route.params.id)" />
          </div>
          <MatchesTable :matches="pagedTeamMatches" :show-all-matches="true" />
          <Pagination
            v-if="teamMatches.length > matchesPerPage"
            :total="teamMatches.length"
            :page="matchesPage"
            :per-page="matchesPerPage"
            @page="matchesPage = $event"
          />
        </div>
      </div>

      <div v-else-if="tab === 'stats'" class="space-y-6">
        <TeamCareerStats :team-id="String($route.params.id)" />
        <TeamVetoStats :team-id="String($route.params.id)" />
        <TeamVetoSimulator :team-id="String($route.params.id)" />
      </div>

      <div v-else-if="tab === 'highlights'">
        <div class="flex flex-col gap-1">
          <span :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses" />
            {{ $t("common.highlights") }}
          </span>
          <span :class="tacticalSectionDescriptionClasses">
            {{ $t("team.highlights.subtitle") }}
          </span>
        </div>
        <TeamHighlights :team-id="String($route.params.id)" />
      </div>

      <div v-else-if="tab === 'scrim' && showScrimTab">
        <TeamScrimManager
          v-if="team.can_manage_scrims"
          :team-id="String($route.params.id)"
          :initial-tab="String($route.query.scrimTab || '')"
        />
        <div v-else class="space-y-4">
          <div class="flex flex-col gap-1">
            <span :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("team.tabs.scrim") }}
            </span>
            <span :class="tacticalSectionDescriptionClasses">
              {{ $t("team.scrim_open_description") }}
            </span>
          </div>
          <div
            class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card/30 p-4"
          >
            <div class="flex items-center gap-3">
              <span class="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span
                  class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
                />
                <span
                  class="relative inline-flex h-2.5 w-2.5 rounded-full bg-[hsl(var(--tac-amber))]"
                />
              </span>
              <div>
                <div
                  class="text-sm font-semibold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
                >
                  {{ $t("scrim.open_to_scrims") }}
                </div>
                <TeamRankSummary
                  class="mt-1"
                  :ranks="team.ranks"
                  :reputation="team.reputation"
                />
              </div>
            </div>
            <Button
              class="tac-amber-cta"
              :disabled="!me"
              @click="scrimRequestOpen = true"
            >
              {{ $t("scrim.request_scrim") }}
            </Button>
          </div>
          <ScrimRequestDialog
            v-model:open="scrimRequestOpen"
            :posting="teamPosting"
          />
        </div>
      </div>
    </div>
  </Transition>

  <Sheet
    v-if="team"
    :open="editTeamSheet"
    @update:open="(open) => (editTeamSheet = open)"
  >
    <SheetContent class="flex flex-col gap-0">
      <SheetHeader>
        <SheetTitle>{{ $t("team.management.edit") }}</SheetTitle>
        <SheetDescription class="sr-only">
          {{ $t("team.management.edit") }}
        </SheetDescription>
      </SheetHeader>
      <div class="-mx-4 mt-6 flex-1 space-y-6 overflow-y-auto px-4">
        <div class="space-y-2">
          <div
            class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
            {{ $t("avatar.team_avatar") }}
          </div>
          <ImageUploadTile
            class="max-w-[9rem]"
            aspect="square"
            fit="cover"
            :upload-url="`https://${apiDomain}/avatars/teams/${team.id}`"
            :delete-url="`https://${apiDomain}/avatars/teams/${team.id}`"
            :has-custom="!!team.avatar_url"
            :current-src="teamAvatarSrc"
          />
        </div>
        <TeamForm :team="team" @updated="editTeamSheet = false" />
      </div>
    </SheetContent>
  </Sheet>

  <AlertDialog
    :open="deleteTeamAlertDialog"
    @update:open="(open) => (deleteTeamAlertDialog = open)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("team.confirm.delete.title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("team.confirm.delete.description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="deleteTeam"
          >{{ $t("common.confirm") }}</AlertDialogAction
        >
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog
    :open="leaveTeamAlertDialog"
    @update:open="(open) => (leaveTeamAlertDialog = open)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t("team.confirm.leave") }}</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="leaveTeam"
          >{{ $t("common.confirm") }}</AlertDialogAction
        >
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { playerFields } from "~/graphql/playerFields";
import { trophyFields } from "~/graphql/trophyFields";
import { resolveRosterImageUrl } from "~/utilities/rosterImage";

const VALID_TABS = ["overview", "stats", "highlights", "scrim"];

export default {
  data() {
    return {
      team: undefined,
      tab: VALID_TABS.includes(useRoute().query.tab as string)
        ? (useRoute().query.tab as string)
        : "overview",
      teamTrophies: [] as any[],
      tournamentMatches: [] as any[],
      matchesPage: 1,
      matchesPerPage: 5,
      editTeamSheet: false,
      leaveTeamAlertDialog: false,
      deleteTeamAlertDialog: false,
      scrimRequestOpen: false,
    };
  },
  watch: {
    tab(value: string) {
      // Reflect the active tab in the URL bar via history (no router navigation,
      // so nothing re-renders/reloads) — still deep-linkable on fresh load.
      if (typeof window === "undefined") {
        return;
      }
      const url = new URL(window.location.href);
      if (value === "overview") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", value);
      }
      window.history.replaceState(window.history.state, "", url.toString());
    },
  },
  apollo: {
    $subscribe: {
      teams_by_pk: {
        query: typedGql("subscription")({
          teams_by_pk: [
            {
              id: $("teamId", "uuid!"),
            },
            {
              id: true,
              name: true,
              short_name: true,
              avatar_url: true,
              is_organization: true,
              owner_steam_id: true,
              captain_steam_id: true,
              can_manage_scrims: true,
              ranks: {
                avg_elo: true,
                min_elo: true,
                max_elo: true,
                avg_faceit_level: true,
                avg_faceit_elo: true,
                avg_premier: true,
                roster_size: true,
              },
              reputation: {
                scrims_completed: true,
                no_shows: true,
                reliability_pct: true,
              },
              scrim_settings: {
                enabled: true,
                map_ids: true,
              },
              scrim_availability: {
                starts_at: true,
                ends_at: true,
                recurring_weekly: true,
              },
              owner: playerFields,
              captain: playerFields,
              roster: [
                {},
                {
                  roster_image_url: true,
                  player: playerFields,
                },
              ],
              matches: [
                {
                  order_by: [
                    {
                      created_at: order_by.desc,
                    },
                  ],
                },
                simpleMatchFields,
              ],
            },
          ],
        }),
        variables: function () {
          return {
            teamId: this.$route.params.id,
          };
        },
        result: function ({ data }) {
          this.team = data.teams_by_pk;
          const ctx = useTeamContext();
          if (this.team) {
            ctx.value = {
              id: this.team.id,
              name: this.team.name,
            };
          } else {
            ctx.value = null;
          }
        },
      },
      tournamentMatches: {
        query: typedGql("subscription")({
          matches: [
            {
              order_by: [
                {
                  created_at: order_by.desc,
                },
              ],
              where: {
                tournament_brackets: {
                  _or: [
                    {
                      team_1: {
                        team_id: {
                          _eq: $("teamId", "uuid!"),
                        },
                      },
                    },
                    {
                      team_2: {
                        team_id: {
                          _eq: $("teamId", "uuid!"),
                        },
                      },
                    },
                  ],
                },
              },
            },
            simpleMatchFields,
          ],
        }),
        variables: function () {
          return {
            teamId: this.$route.params.id,
          };
        },
        result: function ({ data }) {
          this.tournamentMatches = data.matches || [];
        },
      },
      teamTrophies: {
        query: typedGql("subscription")({
          tournament_trophies: [
            {
              where: {
                player_steam_id: {
                  _is_null: true,
                },
                tournament_team: {
                  team_id: {
                    _eq: $("teamId", "uuid!"),
                  },
                },
              },
            },
            trophyFields,
          ],
        }),
        variables: function () {
          return {
            teamId: this.$route.params.id,
          };
        },
        result: function ({ data }) {
          this.teamTrophies = data.tournament_trophies || [];
        },
      },
    },
  },
  unmounted() {
    useTeamContext().value = null;
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    scrimFinderEnabled() {
      return useApplicationSettingsStore().scrimFinderEnabled;
    },
    teamOpenToScrims(): boolean {
      return this.team?.scrim_settings?.enabled === true;
    },
    showScrimTab(): boolean {
      return (
        this.scrimFinderEnabled &&
        (this.team?.can_manage_scrims || this.teamOpenToScrims)
      );
    },
    teamPosting(): any {
      if (!this.team) {
        return null;
      }
      return {
        team_id: this.team.id,
        map_ids: this.team.scrim_settings?.map_ids ?? [],
        team: {
          name: this.team.name,
          avatar_url: this.team.avatar_url,
          ranks: this.team.ranks,
          reputation: this.team.reputation,
          scrim_availability: this.team.scrim_availability ?? [],
        },
      };
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    teamAvatarSrc() {
      if (!this.team?.avatar_url) return null;
      return `https://${this.apiDomain}/${this.team.avatar_url}`;
    },
    teamCaptain() {
      return this.team?.captain || this.team?.owner;
    },
    teamCaptainRosterImageSrc() {
      const captain = this.teamCaptain;
      if (!captain) return null;
      const rosterEntry = this.team?.roster?.find(
        (m: any) => m.player?.steam_id === captain.steam_id,
      );
      return resolveRosterImageUrl(rosterEntry, captain, this.apiDomain);
    },
    teamMatches() {
      const matchesById = new Map<string, any>();

      for (const match of [
        ...(this.team?.matches || []),
        ...this.tournamentMatches,
      ]) {
        if (match?.id && !matchesById.has(match.id)) {
          matchesById.set(match.id, match);
        }
      }

      return Array.from(matchesById.values()).sort((a, b) => {
        const aDate = a.started_at || a.scheduled_at || a.created_at;
        const bDate = b.started_at || b.scheduled_at || b.created_at;

        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    },
    pagedTeamMatches() {
      const start = (this.matchesPage - 1) * this.matchesPerPage;
      return this.teamMatches.slice(start, start + this.matchesPerPage);
    },
    isOnTeam() {
      return !!this.team?.roster.some(({ player }) => {
        return player.steam_id === this.me?.steam_id;
      });
    },
    isAdmin() {
      return useAuthStore().isAdmin;
    },
  },
  methods: {
    async deleteTeam() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_teams_by_pk: [
            {
              id: this.$route.params.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.$router.push("/teams");
    },
    async leaveTeam() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_team_roster_by_pk: [
            {
              team_id: this.$route.params.id,
              player_steam_id: this.me.steam_id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.$router.push("/teams");
    },
  },
};
</script>
