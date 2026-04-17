<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TournamentStageBuilder from "~/components/tournament/TournamentStageBuilder.vue";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";
import TournamentForm from "~/components/tournament/TournamentForm.vue";
import TournamentOrganizers from "~/components/tournament/TournamentOrganizers.vue";
import TournamentNotifications from "~/components/tournament/TournamentNotifications.vue";
import TournamentResults from "~/components/tournament/TournamentResults.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchOptionsDisplay from "~/components/match/MatchOptionsDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import {
  Settings,
  Users,
  ChevronDown,
  Lock,
  Unlock,
  Ban,
  UserPlus,
  Trash,
  Play,
  Pause,
  RotateCcw,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NuxtLink } from "#components";
import MatchTableRow from "~/components/MatchTableRow.vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import {
  tacticalCtaButtonClasses,
  tacticalSectionDescriptionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";

const tournamentHeroClasses =
  "relative rounded-lg border border-border px-7 py-6 [background:linear-gradient(180deg,hsl(var(--card)_/_0.55)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-[''] max-md:px-4 max-md:py-5";
const tournamentHeroToplineClasses =
  "mb-5 flex flex-wrap items-start justify-between gap-3";
const tournamentHeroEyebrowClasses =
  "inline-flex min-h-9 items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground";
const tournamentHeroChevronClasses =
  "translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]";
const tournamentHeroBodyClasses = "min-w-0";
const tournamentHeroIdentityClasses =
  "flex min-w-0 flex-col gap-[0.65rem]";
const tournamentHeroNameRowClasses = "flex min-w-0 items-center";
const tournamentHeroNameClasses =
  "relative m-0 min-w-0 font-sans text-[clamp(1.75rem,4vw,3rem)] font-bold uppercase leading-[0.95] tracking-[0.02em] [font-stretch:80%]";
const tournamentHeroNameMainClasses = "relative text-foreground";
const tournamentHeroNameGhostClasses =
  "pointer-events-none absolute left-[5px] top-[5px] right-[-5px] overflow-hidden whitespace-nowrap text-transparent select-none [-webkit-text-stroke:1px_hsl(var(--tac-amber)_/_0.35)]";
const tournamentHeroBadgesClasses = "flex flex-wrap gap-1.5";
const tournamentHeroTagClasses =
  "inline-flex items-center rounded border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] px-[0.55rem] py-[0.2rem] font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]";
const tournamentHeroMutedTagClasses =
  "border-border bg-muted/30 text-muted-foreground";
const tournamentHeroMetaClasses =
  "inline-flex flex-wrap items-center gap-[0.55rem] text-xs text-muted-foreground";
const tournamentHeroMetaDotClasses = "opacity-40";
const tournamentHeroMetaLabelClasses =
  "font-mono text-[0.65rem] uppercase tracking-[0.22em]";
const tournamentHeroOrganizersClasses = "inline-flex items-center gap-[0.3rem]";
const tournamentHeroOrganizerClasses =
  "inline-flex cursor-pointer transition-[opacity,transform] duration-150 hover:-translate-y-px hover:opacity-85";
const tournamentHeroActionsClasses =
  "flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:justify-start";
const tournamentHeroStatusClasses =
  "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded border border-border bg-muted/30 px-[0.7rem] py-[0.3rem] font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground max-sm:flex-1 max-sm:justify-center";
const tournamentHeroStatusDotClasses = "h-1.5 w-1.5 rounded-full bg-current";
const tournamentHeroStatusTierClasses: Record<string, string> = {
  live: "border-destructive/55 bg-destructive/15 text-destructive",
  open: "border-success/55 bg-success/15 text-success",
  pending:
    "border-[hsl(var(--tac-amber)_/_0.5)] bg-[hsl(var(--tac-amber)_/_0.12)] text-[hsl(var(--tac-amber))]",
  paused: "border-warning/55 bg-warning/15 text-warning",
  finished:
    "border-[hsl(var(--topnav-accent)_/_0.5)] bg-[hsl(var(--topnav-accent)_/_0.15)] text-[hsl(var(--topnav-accent))]",
  ended: "border-border bg-muted/40 text-muted-foreground",
};
const tournamentHeroJoinButtonClasses = [
  tacticalCtaButtonClasses,
  "h-9 px-4 py-2 text-[0.68rem] tracking-[0.14em] max-sm:flex-1 max-sm:px-3",
];
const tournamentHeroSettingsButtonClasses =
  "h-9 w-9 border-[hsl(var(--tac-amber)_/_0.45)] bg-background/45 text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)_/_0.12)] hover:text-[hsl(var(--tac-amber))]";
const tournamentHeroDetailsClasses = "mt-5 border-t border-border pt-4";
const tournamentHeroDetailsTriggerClasses =
  "flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-[0.85rem] text-muted-foreground transition-colors duration-150 hover:text-foreground";
const tournamentHeroDescriptionClasses =
  "min-w-0 flex-1 break-words leading-[1.45]";
const tournamentHeroDetailsPlaceholderClasses =
  "flex-1 font-mono text-[0.72rem] uppercase tracking-[0.2em]";
const tournamentHeroDetailsBodyClasses = "mt-4 border-t border-border pt-4";
const tournamentHeroTabsClasses = "mt-5 border-t border-border pt-4";
const tacticalSectionCountClasses =
  "rounded-full border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] px-[0.45rem] py-[0.05rem] text-[0.62rem] tracking-[0.08em] text-[hsl(var(--tac-amber))]";
const tournamentTeamCardClasses =
  "rounded-lg border border-border bg-card/45 px-5 py-4 [backdrop-filter:blur(6px)] transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.35)] hover:bg-card/60";
const myTeamClasses = "max-w-[900px]";
const myTeamHeaderClasses = "mb-4 flex flex-col gap-[0.35rem]";
const myTeamLabelClasses =
  "inline-flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground";
const myTeamHintClasses = "text-[0.8rem] text-muted-foreground/80";
const tacticalCornerCardClasses =
  "relative rounded-lg border border-border px-6 py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.65)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:-left-px before:-top-px before:h-3 before:w-3 before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:-bottom-px after:-right-px after:h-3 after:w-3 after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']";
const tournamentAdminPanelClasses =
  "relative border border-border p-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.65)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)]";
const tournamentAdminCornerClasses =
  "pointer-events-none absolute h-3 w-3 border-[hsl(var(--tac-amber))]";
const tournamentAdminHeaderClasses =
  "mb-[0.4rem] inline-flex items-center gap-2";
const tournamentAdminTickClasses =
  "h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]";
const tournamentAdminLabelClasses =
  "font-mono text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[hsl(var(--tac-amber))]";
const tournamentAdminTitleClasses =
  "mb-[0.35rem] font-sans text-[1.1rem] font-bold uppercase tracking-[0.05em] text-foreground";
const tournamentAdminDescClasses =
  "mb-4 text-[0.8rem] leading-[1.4] text-muted-foreground";
const tournamentAdminBodyClasses = "border-t border-border pt-[0.85rem]";
</script>

<template>
  <div v-if="tournament">
    <Tabs v-model="activeTab" default-value="overview">
      <!-- Tactical Hero -->
      <PageTransition>
        <header :class="tournamentHeroClasses">
          <div :class="tournamentHeroToplineClasses">
            <div :class="tournamentHeroEyebrowClasses">
              <span :class="tournamentHeroChevronClasses">◢</span>
              Tournament
            </div>

            <div :class="tournamentHeroActionsClasses">
              <span
                :class="[
                  tournamentHeroStatusClasses,
                  tournamentHeroStatusTierClasses[statusTier] ??
                    tournamentHeroStatusTierClasses.ended,
                ]"
              >
                <span :class="tournamentHeroStatusDotClasses"></span>
                {{ tournament.e_tournament_status.description }}
              </span>

              <Button
                v-if="
                  tournament.status ===
                    e_tournament_status_enum.RegistrationOpen &&
                  tournament.can_join
                "
                size="sm"
                :class="tournamentHeroJoinButtonClasses"
                @click="handleJoinTournament"
              >
                <UserPlus class="h-3.5 w-3.5" />
                {{ $t("tournament.join.title") }}
              </Button>

              <DropdownMenu v-if="tournament?.is_organizer">
                <DropdownMenuTrigger as-child>
                  <Button
                    variant="outline"
                    size="icon"
                    :class="tournamentHeroSettingsButtonClasses"
                    :title="$t('tournament.settings')"
                  >
                    <Settings class="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent class="w-56" align="end">
                  <DropdownMenuItem
                    v-if="tournament.can_open_registration"
                    @click="openRegistration"
                    class="cursor-pointer"
                  >
                    <Unlock class="mr-2 h-4 w-4" />
                    <span>{{
                      $t("tournament.actions.open_registration")
                    }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="tournament.can_close_registration"
                    @click="closeRegistration"
                    class="cursor-pointer"
                  >
                    <Lock class="mr-2 h-4 w-4" />
                    <span>{{
                      $t("tournament.actions.close_registration")
                    }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="tournament.can_start && !tournament.can_resume"
                    @click="startTournament"
                    class="cursor-pointer"
                  >
                    <Play class="mr-2 h-4 w-4" />
                    <span>{{ $t("tournament.actions.start") }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="tournament.can_pause"
                    @click="pauseDialogOpen = true"
                    class="cursor-pointer"
                  >
                    <Pause class="mr-2 h-4 w-4" />
                    <span>{{ $t("tournament.actions.pause") }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="tournament.can_resume"
                    @click="resumeDialogOpen = true"
                    class="cursor-pointer"
                  >
                    <Play class="mr-2 h-4 w-4" />
                    <span>{{ $t("tournament.actions.resume") }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="tournament.can_setup"
                    @click="resetToSetup"
                    class="cursor-pointer"
                  >
                    <RotateCcw class="mr-2 h-4 w-4" />
                    <span>{{ $t("tournament.actions.reset_to_setup") }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator
                    v-if="
                      (tournament.can_open_registration ||
                        tournament.can_close_registration ||
                        tournament.can_start ||
                        tournament.can_setup) &&
                      (tournament.can_cancel || tournament.is_organizer)
                    "
                  />
                  <DropdownMenuItem
                    v-if="tournament.can_cancel"
                    @click="cancelTournament"
                    class="text-destructive cursor-pointer"
                  >
                    <Ban class="mr-2 h-4 w-4" />
                    <span>{{ $t("tournament.actions.cancel") }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator
                    v-if="tournament.can_cancel && tournament.is_organizer"
                  />
                  <DropdownMenuItem
                    v-if="tournament.is_organizer"
                    @click="deleteDialogOpen = true"
                    class="text-destructive cursor-pointer"
                  >
                    <Trash class="mr-2 h-4 w-4" />
                    <span>{{ $t("tournament.actions.delete") }}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div :class="tournamentHeroBodyClasses">
            <!-- Identity -->
            <div :class="tournamentHeroIdentityClasses">
              <div :class="tournamentHeroNameRowClasses">
                <h1 :class="tournamentHeroNameClasses">
                  <span
                    :class="tournamentHeroNameGhostClasses"
                    aria-hidden="true"
                  >
                    {{ tournament.name }}
                  </span>
                  <span :class="tournamentHeroNameMainClasses">
                    {{ tournament.name }}
                  </span>
                </h1>
              </div>

              <div :class="tournamentHeroBadgesClasses">
                <span :class="tournamentHeroTagClasses">
                  {{ tournament.options.type }}
                </span>
                <span
                  v-if="stageCount > 1"
                  :class="[
                    tournamentHeroTagClasses,
                    tournamentHeroMutedTagClasses,
                  ]"
                >
                  {{ stageCount }} {{ $t("tournament.stage.stages") }}
                </span>
                <span
                  v-if="singleStageType"
                  :class="[
                    tournamentHeroTagClasses,
                    tournamentHeroMutedTagClasses,
                  ]"
                >
                  {{ singleStageTypeWithBestOf }}
                </span>
              </div>

              <div :class="tournamentHeroMetaClasses">
                <TimeAgo :date="tournament.start" />
                <span :class="tournamentHeroMetaDotClasses">·</span>
                <span :class="tournamentHeroMetaLabelClasses">
                  {{ $t("tournament.organizer.organized_by") }}
                </span>
                <div :class="tournamentHeroOrganizersClasses">
                  <template
                    v-for="(organizer, index) in organizersList"
                    :key="organizer.steam_id"
                  >
                    <Popover v-model:open="organizerPopoversOpen[index]">
                      <PopoverTrigger as-child>
                        <button
                          type="button"
                          :class="tournamentHeroOrganizerClasses"
                          @mouseenter="organizerPopoversOpen[index] = true"
                          @mouseleave="organizerPopoversOpen[index] = false"
                        >
                          <Avatar shape="square" class="h-6 w-6">
                            <AvatarImage
                              :src="organizer.avatar_url"
                              :alt="organizer.name"
                              v-if="organizer?.avatar_url"
                            />
                            <AvatarFallback class="text-[0.6rem]">
                              {{ organizer?.name.slice(0, 2) }}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        class="w-64 p-0"
                        @mouseenter="organizerPopoversOpen[index] = true"
                        @mouseleave="organizerPopoversOpen[index] = false"
                      >
                        <div class="p-4">
                          <PlayerDisplay
                            :player="organizer"
                            :linkable="true"
                            :tooltip="false"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Description + Match Options collapsible -->
          <Collapsible
            v-if="tournament.description || tournament.options"
            v-model:open="overviewExpanded"
            :class="tournamentHeroDetailsClasses"
          >
            <CollapsibleTrigger as-child>
              <button
                type="button"
                :class="tournamentHeroDetailsTriggerClasses"
              >
                <span
                  v-if="tournament.description"
                  :class="[
                    tournamentHeroDescriptionClasses,
                    { 'line-clamp-2': !overviewExpanded },
                  ]"
                >
                  {{ tournament.description }}
                </span>
                <span v-else :class="tournamentHeroDetailsPlaceholderClasses">
                  View match options
                </span>
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform duration-200"
                  :class="{ 'rotate-180': overviewExpanded }"
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div :class="tournamentHeroDetailsBodyClasses">
                <MatchOptionsDisplay
                  :show-details-by-default="false"
                  :options="tournament.options"
                ></MatchOptionsDisplay>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <!-- Tabs inside the hero (bottom row) -->
          <div :class="tournamentHeroTabsClasses">
            <TabsList
              variant="underline"
              :class="[tacticalTabsListClasses, 'h-auto flex-wrap']"
            >
              <TabsTrigger value="overview" :class="tacticalTabsTriggerClasses">
                {{ $t("tournament.overview") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="myTeam"
                value="my-team"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.teams.my_teams") }}
              </TabsTrigger>
              <TabsTrigger value="teams" :class="tacticalTabsTriggerClasses">
                {{
                  $t("tournament.teams.count", {
                    count: tournament?.teams_aggregate?.aggregate?.count || 0,
                  })
                }}
              </TabsTrigger>
              <TabsTrigger
                v-if="
                  tournament.status === e_tournament_status_enum.Live ||
                  tournament.status === e_tournament_status_enum.Finished
                "
                value="standings"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.standings.title") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="
                  tournament.status === e_tournament_status_enum.Live ||
                  tournament.status === e_tournament_status_enum.Finished
                "
                value="results"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.results.title") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="tournament?.is_organizer"
                value="match-options"
                :class="tacticalTabsTriggerClasses"
              >
                Match Options
              </TabsTrigger>
              <TabsTrigger
                v-if="tournament?.is_organizer"
                value="organizers"
                :class="tacticalTabsTriggerClasses"
              >
                Organizers
              </TabsTrigger>
              <TabsTrigger
                v-if="tournament?.is_organizer"
                value="notifications"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.notifications.title") }}
              </TabsTrigger>
            </TabsList>
          </div>
        </header>
      </PageTransition>

      <div
        v-if="tournament.status === e_tournament_status_enum.Paused"
        class="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {{ $t("tournament.paused_banner") }}
      </div>

      <div class="mt-6">
        <TabsContent value="overview">
          <PageTransition>
            <TournamentStageBuilder
              class="w-full"
              :tournament="tournament"
            ></TournamentStageBuilder>
          </PageTransition>
        </TabsContent>
        <TabsContent value="my-team" v-if="myTeam">
          <PageTransition>
            <div :class="myTeamClasses">
              <div :class="myTeamHeaderClasses">
                <div :class="myTeamLabelClasses">
                  <span :class="tacticalSectionTickClasses"></span>
                  My Team
                </div>
                <div :class="myTeamHintClasses">
                  Manage your roster, invites, and readiness for this
                  tournament.
                </div>
              </div>

              <div :class="tacticalCornerCardClasses">
                <TournamentTeam
                  :tournament="tournament"
                  :team="myTeam"
                ></TournamentTeam>
              </div>
            </div>
          </PageTransition>
        </TabsContent>
        <TabsContent value="teams">
          <div
            class="grid gap-6 items-start"
            :class="
              tournament.is_organizer
                ? 'lg:grid-cols-[minmax(0,1fr)_360px]'
                : 'grid-cols-1'
            "
          >
            <div class="min-w-0">
              <div :class="[tacticalSectionLabelClasses, 'mb-[0.85rem]']">
                <span :class="tacticalSectionTickClasses"></span>
                Roster
                <span :class="tacticalSectionCountClasses">
                  {{ tournament?.teams?.length || 0 }}
                </span>
              </div>

              <div
                v-if="!tournament.teams || tournament.teams.length === 0"
                class="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground"
              >
                No teams yet.
              </div>

              <div class="space-y-4">
                <PageTransition
                  v-for="(team, index) of tournament.teams"
                  :key="team.id"
                  :delay="index * 40"
                >
                  <div :class="tournamentTeamCardClasses">
                    <TournamentTeam
                      :tournament="tournament"
                      :team="team"
                    ></TournamentTeam>
                  </div>
                </PageTransition>
              </div>
            </div>

            <div v-if="tournament.is_organizer" class="lg:sticky lg:top-6">
              <PageTransition :delay="150">
                <aside :class="tournamentAdminPanelClasses">
                  <div
                    :class="[
                      tournamentAdminCornerClasses,
                      '-left-px -top-px border-l-2 border-t-2',
                    ]"
                  ></div>
                  <div
                    :class="[
                      tournamentAdminCornerClasses,
                      '-bottom-px -right-px border-b-2 border-r-2',
                    ]"
                  ></div>

                  <div :class="tournamentAdminHeaderClasses">
                    <span :class="tournamentAdminTickClasses"></span>
                    <span :class="tournamentAdminLabelClasses">{{
                      $t("tournament.admin_label")
                    }}</span>
                  </div>
                  <h3 :class="tournamentAdminTitleClasses">
                    {{ $t("tournament.add_team.title") }}
                  </h3>
                  <p :class="tournamentAdminDescClasses">
                    {{ $t("tournament.add_team.description") }}
                  </p>
                  <div :class="tournamentAdminBodyClasses">
                    <TournamentJoinForm
                      :tournament="tournament"
                    ></TournamentJoinForm>
                  </div>
                </aside>
              </PageTransition>
            </div>
          </div>
        </TabsContent>
        <TabsContent
          v-if="
            tournament.status === e_tournament_status_enum.Live ||
            tournament.status === e_tournament_status_enum.Finished
          "
          value="standings"
        >
          <PageTransition>
            <TournamentResults
              :tournament="tournament"
              :show-standings="true"
              :show-matches="false"
            />
          </PageTransition>
        </TabsContent>
        <TabsContent
          v-if="
            tournament.status === e_tournament_status_enum.Live ||
            tournament.status === e_tournament_status_enum.Finished
          "
          value="results"
        >
          <PageTransition>
            <TournamentResults
              :tournament="tournament"
              :show-standings="false"
              :show-matches="true"
            />
          </PageTransition>
        </TabsContent>
        <TabsContent value="match-options" v-if="tournament?.is_organizer">
          <PageTransition>
            <TournamentForm :tournament="tournament"></TournamentForm>
          </PageTransition>
        </TabsContent>
        <TabsContent value="organizers" v-if="tournament?.is_organizer">
          <PageTransition>
            <TournamentOrganizers
              :tournament="tournament"
            ></TournamentOrganizers>
          </PageTransition>
        </TabsContent>
        <TabsContent value="notifications" v-if="tournament?.is_organizer">
          <PageTransition>
            <TournamentNotifications
              :tournament="tournament"
            ></TournamentNotifications>
          </PageTransition>
        </TabsContent>
      </div>
    </Tabs>

    <!-- Join Tournament Sheet - Available for all tabs -->
    <Sheet
      :open="joinSheetOpen"
      @update:open="(open) => (joinSheetOpen = open)"
    >
      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle class="text-2xl">
            {{ $t("tournament.join.title") }}
          </SheetTitle>
          <SheetDescription>
            {{
              $t("tournament.join.requirements", {
                count: tournament.min_players_per_lineup,
              })
            }}
          </SheetDescription>
        </SheetHeader>

        <div class="mt-6">
          <TournamentJoinForm
            :tournament="tournament"
            @close="joinSheetOpen = false"
          />
        </div>
      </SheetContent>
    </Sheet>

    <!-- Delete Tournament Dialog -->
    <AlertDialog
      :open="deleteDialogOpen"
      @update:open="(open) => (deleteDialogOpen = open)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("tournament.actions.confirm_delete")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("tournament.actions.delete_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction
            @click="deleteTournament"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {{ $t("tournament.actions.delete") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Pause Tournament Dialog -->
    <AlertDialog
      :open="pauseDialogOpen"
      @update:open="(open) => (pauseDialogOpen = open)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("tournament.actions.confirm_pause")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("tournament.actions.pause_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction @click="pauseTournament">
            {{ $t("tournament.actions.pause") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Resume Tournament Dialog -->
    <AlertDialog
      :open="resumeDialogOpen"
      @update:open="(open) => (resumeDialogOpen = open)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("tournament.actions.resume")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("tournament.actions.resume_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction @click="resumeTournament">
            {{ $t("tournament.actions.resume") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script lang="ts">
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useAuthStore } from "~/stores/AuthStore";
import tournamentTeamFields from "~/graphql/tournamentTeamFields";
import { mapFields } from "~/graphql/mapGraphql";
import { playerFields } from "~/graphql/playerFields";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";

export default {
  data() {
    return {
      myTeam: undefined,
      tournament: undefined,
      tournamentDialog: false,
      teamSearchQuery: undefined,
      settingsDialogOpen: false,
      organizersDialogOpen: false,
      joinSheetOpen: false,
      overviewExpanded: true,
      deleteDialogOpen: false,
      pauseDialogOpen: false,
      resumeDialogOpen: false,
      organizerPopoversOpen: {},
      activeTab: "overview",
      e_match_types: [],
    };
  },
  unmounted() {
    useTournamentContext().value = null;
  },
  apollo: {
    e_match_types: {
      fetchPolicy: "cache-first",
      query: generateQuery({
        e_match_types: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
      result({
        data,
      }: {
        data: { e_match_types: Array<{ value: string; description: string }> };
      }) {
        this.e_match_types = data.e_match_types;
      },
    },
    $subscribe: {
      tournaments_by_pk: {
        query: typedGql("subscription")({
          tournaments_by_pk: [
            {
              id: $("tournamentId", "uuid!"),
            },
            {
              id: true,
              name: true,
              start: true,
              status: true,
              auto_start: true,
              e_tournament_status: {
                description: true,
              },
              description: true,
              is_organizer: true,
              can_join: true,
              can_start: true,
              can_cancel: true,
              can_open_registration: true,
              can_close_registration: true,
              can_pause: true,
              can_resume: true,
              can_setup: true,
              min_players_per_lineup: true,
              max_players_per_lineup: true,
              admin: playerFields,
              options: matchOptionsFields,
              organizers: [
                {},
                {
                  organizer: playerFields,
                },
              ],
              teams: [
                {
                  order_by: [
                    {
                      seed: order_by.asc,
                    },
                    {
                      eligible_at: order_by.asc,
                    },
                    {
                      created_at: order_by.asc,
                    },
                  ],
                },
                tournamentTeamFields,
              ],
              teams_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
                },
              ],
              stages: [
                {
                  order_by: [
                    {
                      order: order_by.asc,
                    },
                  ],
                },
                {
                  id: true,
                  type: true,
                  e_tournament_stage_type: {
                    description: true,
                  },
                  order: true,
                  groups: true,
                  min_teams: true,
                  max_teams: true,
                  decider_best_of: true,
                  default_best_of: true,
                  settings: true,
                  third_place_match: true,
                  options: matchOptionsFields,
                  results: [
                    {},
                    {
                      wins: true,
                      losses: true,
                      rounds_won: true,
                      rounds_lost: true,
                      matches_played: true,
                      matches_remaining: true,
                      team: {
                        name: true,
                      },
                    },
                  ],
                  brackets: [
                    {
                      order_by: [
                        {
                          round: order_by.asc,
                        },
                        {
                          group: order_by.asc,
                        },
                        {
                          path: order_by.desc,
                        },
                        {
                          match_number: order_by.asc,
                        },
                      ],
                    },
                    {
                      id: true,
                      round: true,
                      group: true,
                      bye: true,
                      match_number: true,
                      scheduled_at: true,
                      scheduled_eta: true,
                      team_1_seed: true,
                      team_2_seed: true,
                      path: true,
                      loser_parent_bracket_id: true,
                      match_options_id: true,
                      options: matchOptionsFields,
                      parent_bracket: {
                        id: true,
                        round: true,
                        group: true,
                        match_number: true,
                        path: true,
                      },
                      loser_bracket: {
                        id: true,
                        round: true,
                        group: true,
                        match_number: true,
                        path: true,
                      },
                      feeding_brackets: {
                        id: true,
                        round: true,
                        group: true,
                        match_number: true,
                        path: true,
                        parent_bracket_id: true,
                        loser_parent_bracket_id: true,
                        team_1_seed: true,
                        team_2_seed: true,
                      },
                      match: {
                        id: true,
                        status: true,
                        ended_at: true,
                        e_match_status: {
                          description: true,
                        },
                        winning_lineup_id: true,
                        lineup_1_id: true,
                        lineup_2_id: true,
                        created_at: true,
                        started_at: true,
                        scheduled_at: true,
                        options: {
                          mr: true,
                          best_of: true,
                          type: true,
                          lobby_access: true,
                        },
                        match_maps: [
                          {
                            order_by: [
                              {
                                order: order_by.asc,
                              },
                            ],
                          },
                          {
                            map: mapFields,
                            lineup_1_score: true,
                            lineup_2_score: true,
                            winning_lineup_id: true,
                            order: true,
                            status: true,
                            vetos: {
                              side: true,
                              type: true,
                              match_lineup_id: true,
                            },
                          },
                        ],
                        lineup_1: {
                          id: true,
                          name: true,
                          is_on_lineup: true,
                          team_id: true,
                          lineup_players: [
                            {},
                            {
                              checked_in: true,
                              placeholder_name: true,
                              player: playerFields,
                            },
                          ],
                        },
                        lineup_2: {
                          id: true,
                          name: true,
                          is_on_lineup: true,
                          team_id: true,
                          lineup_players: [
                            {},
                            {
                              checked_in: true,
                              placeholder_name: true,
                              player: playerFields,
                            },
                          ],
                        },
                        max_players_per_lineup: true,
                        min_players_per_lineup: true,
                        lineup_counts: [{}, true],
                        streams: [
                          {
                            order_by: [
                              {
                                priority: order_by.asc,
                              },
                            ],
                          },
                          {
                            id: true,
                            link: true,
                            title: true,
                            priority: true,
                          },
                        ],
                        elo_changes: [
                          {},
                          {
                            player_steam_id: true,
                            elo_change: true,
                          },
                        ],
                      },
                      team_1: {
                        id: true,
                        name: true,
                        team: {
                          name: true,
                        },
                      },
                      team_2: {
                        id: true,
                        name: true,
                        team: {
                          name: true,
                        },
                      },
                      created_at: true,
                    },
                  ],
                },
              ],
            },
          ],
        }),
        variables: function () {
          return {
            tournamentId: this.$route.params.tournamentId,
          };
        },
        result: function ({ data }) {
          this.tournament = data.tournaments_by_pk;
          const ctx = useTournamentContext();
          if (this.tournament) {
            const existing = ctx.value;
            ctx.value = {
              id: this.tournament.id,
              name: this.tournament.name,
              isOrganizer: !!this.tournament.is_organizer,
              // Preserve any participant flag that may have been set from myTeam.
              isParticipant: existing?.isParticipant ?? !!this.myTeam,
            };
          } else {
            ctx.value = null;
          }
        },
      },
      tournament_teams: {
        query: typedGql("subscription")({
          tournament_teams: [
            {
              where: {
                tournament_id: {
                  _eq: $("tournamentId", "uuid!"),
                },
                _or: [
                  {
                    owner_steam_id: {
                      _eq: $("steam_id", "bigint!"),
                    },
                  },
                  {
                    roster: {
                      player_steam_id: {
                        _eq: $("steam_id", "bigint!"),
                      },
                    },
                  },
                ],
              },
            },
            Object.assign({}, tournamentTeamFields, {
              invites: [
                {},
                {
                  id: true,
                  player: playerFields,
                },
              ],
            }),
          ],
        }),
        variables: function () {
          return {
            steam_id: this.me?.steam_id,
            tournamentId: this.$route.params.tournamentId,
          };
        },
        skip: function () {
          return !this.me?.steam_id;
        },
        result: function ({ data }) {
          this.myTeam = data.tournament_teams?.[0];
          const ctx = useTournamentContext();
          if (
            ctx.value &&
            this.tournament &&
            ctx.value.id === this.tournament.id
          ) {
            ctx.value = {
              ...ctx.value,
              isParticipant: !!this.myTeam,
            };
          }
        },
      },
    },
  },
  computed: {
    showSeparators() {
      return useApplicationSettingsStore().showSeparators;
    },
    me() {
      return useAuthStore().me;
    },
    tournamentTypeDescription() {
      if (!this.tournament?.options?.type || !this.e_match_types) {
        return this.tournament?.options?.type || "";
      }
      const matchType = this.e_match_types.find(
        (type) => type.value === this.tournament.options.type,
      );
      return matchType?.description || this.tournament.options.type;
    },
    organizersList() {
      if (!this.tournament) return [];
      const list = [];
      if (this.tournament.admin) {
        list.push(this.tournament.admin);
      }
      if (this.tournament.organizers) {
        this.tournament.organizers.forEach((item) => {
          if (item.organizer) {
            list.push(item.organizer);
          }
        });
      }
      return list;
    },
    stageCount() {
      return this.tournament?.stages?.length || 0;
    },
    singleStageType() {
      if (
        this.stageCount === 1 &&
        this.tournament?.stages?.[0]?.e_tournament_stage_type
      ) {
        return this.tournament.stages[0].e_tournament_stage_type.description;
      }
      return null;
    },
    singleStageTypeWithBestOf() {
      if (!this.singleStageType) return null;

      const stage = this.tournament?.stages?.[0];
      if (!stage) return this.singleStageType;

      // Get best_of from stage default_best_of, or fall back to tournament defaults
      let bestOf: number | null = null;
      if (stage.default_best_of) {
        bestOf = stage.default_best_of;
      } else if (stage.options?.best_of) {
        bestOf = stage.options.best_of;
      } else if (this.tournament?.options?.best_of) {
        bestOf = this.tournament.options.best_of;
      }

      if (bestOf) {
        return `${this.singleStageType} - BO${bestOf}`;
      }

      return this.singleStageType;
    },
    e_tournament_status_enum() {
      return e_tournament_status_enum;
    },
    statusTier() {
      const s = this.tournament?.status;
      if (s === e_tournament_status_enum.Live) return "live";
      if (s === e_tournament_status_enum.RegistrationOpen) return "open";
      if (
        s === e_tournament_status_enum.RegistrationClosed ||
        s === e_tournament_status_enum.Setup
      ) {
        return "pending";
      }
      if (s === e_tournament_status_enum.Paused) return "paused";
      if (s === e_tournament_status_enum.Finished) return "finished";
      if (
        s === e_tournament_status_enum.Cancelled ||
        s === e_tournament_status_enum.CancelledMinTeams
      ) {
        return "ended";
      }
      return "neutral";
    },
  },
  methods: {
    openSettingsDialog() {
      this.settingsDialogOpen = true;
    },
    openOrganizersDialog() {
      this.organizersDialogOpen = true;
    },
    handleJoinTournament() {
      if (!this.me) {
        this.$router.push({
          path: "/login",
          query: { redirect: this.$route.fullPath },
        });
        return;
      }
      this.joinSheetOpen = true;
    },
    async cancelTournament() {
      await this.updateTournamentStatus(e_tournament_status_enum.Cancelled);
    },
    async resetToSetup() {
      await this.updateTournamentStatus(e_tournament_status_enum.Setup);
    },
    async startTournament() {
      await this.updateTournamentStatus(e_tournament_status_enum.Live);
    },
    async openRegistration() {
      await this.updateTournamentStatus(
        e_tournament_status_enum.RegistrationOpen,
      );
    },
    async closeRegistration() {
      await this.updateTournamentStatus(
        e_tournament_status_enum.RegistrationClosed,
      );
    },
    async pauseTournament() {
      await this.updateTournamentStatus(e_tournament_status_enum.Paused);
      this.pauseDialogOpen = false;
    },
    async resumeTournament() {
      await this.updateTournamentStatus(e_tournament_status_enum.Live);
      this.resumeDialogOpen = false;
    },
    async updateTournamentStatus(status: e_tournament_status_enum) {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_tournaments_by_pk: [
              {
                pk_columns: {
                  id: this.tournament.id,
                },
                _set: {
                  status,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      } catch (error: unknown) {
        toast({
          title: this.$t("tournament.actions.update_status_failed"),
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
      }
    },
    async deleteTournament() {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            deleteTournament: [
              {
                tournament_id: this.tournament.id,
              },
              {
                success: true,
              },
            ],
          }),
        });
        toast({
          title: this.$t("tournament.actions.deleted"),
        });
        this.deleteDialogOpen = false;
        this.$router.push({ name: "tournaments" });
      } catch (error: any) {
        toast({
          title: this.$t("tournament.actions.delete_failed"),
          description: error.message,
          variant: "destructive",
        });
      }
    },
  },
  watch: {
    tournament: {
      handler(newTournament) {
        if (newTournament) {
          // Collapse overview by default when tournament is Live, expand otherwise
          this.overviewExpanded =
            newTournament.status !== e_tournament_status_enum.Live;
        }
      },
      immediate: true,
    },
    organizersList: {
      handler(newList) {
        // Initialize organizer popovers state based on the combined list
        if (newList && newList.length > 0) {
          this.organizerPopoversOpen = newList.reduce((acc, _, index) => {
            acc[index] = false;
            return acc;
          }, {});
        }
      },
      immediate: true,
    },
  },
};
</script>
