<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TournamentStageBuilder from "~/components/tournament/TournamentStageBuilder.vue";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";
import TournamentInformationForm from "~/components/tournament/TournamentInformationForm.vue";
import TournamentMatchOptionsForm from "~/components/tournament/TournamentMatchOptionsForm.vue";
import TournamentOrganizers from "~/components/tournament/TournamentOrganizers.vue";
import TournamentPrizes from "~/components/tournament/TournamentPrizes.vue";
import TournamentPrizesManage from "~/components/tournament/TournamentPrizesManage.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import TournamentStatRibbon from "~/components/tournament/TournamentStatRibbon.vue";
import TournamentNotifications from "~/components/tournament/TournamentNotifications.vue";
import TournamentResults from "~/components/tournament/TournamentResults.vue";
import TournamentAwardsConfig from "~/components/tournament/TournamentAwardsConfig.vue";
import TournamentAwardsManage from "~/components/tournament/TournamentAwardsManage.vue";
import TournamentCheckInPanel from "~/components/tournament/TournamentCheckInPanel.vue";
import TournamentCheckInReview from "~/components/tournament/TournamentCheckInReview.vue";
import TournamentEntryGate from "~/components/tournament/TournamentEntryGate.vue";
import TournamentFreeAgents from "~/components/tournament/TournamentFreeAgents.vue";
import TournamentInvites from "~/components/tournament/TournamentInvites.vue";
import TournamentInviteLinks from "~/components/tournament/TournamentInviteLinks.vue";
import TournamentInviteAccept from "~/components/tournament/TournamentInviteAccept.vue";
import TournamentStats from "~/components/tournament/TournamentStats.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchOptionsDisplay from "~/components/match/MatchOptionsDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import {
  Settings,
  Users,
  Lock,
  Unlock,
  Ban,
  UserPlus,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  Globe,
  MapPin,
  Minimize,
  Maximize,
} from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
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
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import HeightMorph from "~/components/ui/transitions/HeightMorph.vue";
import {
  tacticalCtaButtonClasses,
  tacticalSectionDescriptionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";

const tournamentHeroClasses =
  "relative isolate overflow-hidden rounded-lg border border-border px-7 py-6 [background:linear-gradient(180deg,hsl(var(--card)_/_0.55)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)] max-md:px-4 max-md:py-5";
const tournamentHeroToplineClasses =
  "order-2 flex shrink-0 flex-wrap items-start gap-2 max-sm:w-full";
const tournamentHeroBodyClasses =
  "order-1 flex min-w-0 flex-1 items-start gap-4";
const tournamentHeroLogoClasses =
  "h-16 w-16 shrink-0 rounded border border-border bg-muted/30 object-contain sm:h-20 sm:w-20";
const tournamentHeroIdentityClasses =
  "flex min-w-0 flex-1 flex-col gap-[0.65rem]";
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
const tournamentPanelCardClasses =
  "relative rounded-lg border border-border px-6 py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.65)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)]";
// Follows ManageSection's rule: a section is a tick-and-label plus a hairline,
// never a card. The rule has to flip axis because the column does — stacked
// under `lg` it is a top border like tac-section-sep, and side by side with the
// roster it becomes the left border that keeps the two columns legibly apart
// (the grid's own gap alone reads as one undivided field at 360px).
const tournamentAdminPanelClasses =
  "relative border-t border-border/60 pt-8 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0";
// The aside holds one tool now — Add Team. The invite and link lists moved to
// the wide column, which is what stopped this 360px frame growing without bound
// the moment a tournament had more than a couple of invites out.
const tournamentAdminSectionClasses = "grid gap-3";
const tournamentAdminSectionHintClasses =
  "text-[0.75rem] leading-snug text-muted-foreground/80";

function setTeamEnterDelay(el: Element) {
  const step = Number((el as HTMLElement).dataset.stagger ?? 0);
  if (!step) {
    return;
  }
  (el as HTMLElement).style.transitionDelay = `${step * 40}ms`;
}

function clearTeamEnterDelay(el: Element) {
  (el as HTMLElement).style.transitionDelay = "";
}
</script>

<template>
  <div v-if="tournament">
    <NuxtLink
      v-if="leagueSeasonId"
      :to="{
        name: 'league-seasons-seasonId',
        params: { seasonId: leagueSeasonId },
      }"
      class="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
    >
      <ArrowLeft class="h-4 w-4" />
      {{ $t("tournament.page.back_to_league") }}
    </NuxtLink>
    <Tabs v-model="activeTab" default-value="overview">
      <PageTransition>
        <header :class="tournamentHeroClasses">
          <div
            v-if="tournamentBannerSrc"
            aria-hidden="true"
            class="absolute inset-0 -z-10"
          >
            <img
              :src="tournamentBannerSrc"
              class="h-full w-full object-cover opacity-[0.38]"
            />
            <div
              class="absolute inset-0 [background:radial-gradient(600px_300px_at_88%_12%,hsl(var(--tac-amber)/0.1),transparent_62%)]"
            ></div>
            <!-- Top fade keeps the status/settings row legible over busy artwork. -->
            <div
              class="absolute inset-0 [background:linear-gradient(180deg,hsl(var(--card)/0.6)_0%,transparent_34%)]"
            ></div>
            <!-- Left-anchored fade keeps the title/badges/meta column legible over any banner while the artwork breathes on the right. -->
            <div
              class="absolute inset-0 [background:linear-gradient(90deg,hsl(var(--card)/0.92)_0%,hsl(var(--card)/0.5)_44%,hsl(var(--card)/0.1)_80%)]"
            ></div>
            <!-- Bottom fade protects the tab row. -->
            <div
              class="absolute inset-0 [background:linear-gradient(180deg,transparent_0%,hsl(var(--card)/0.4)_64%,hsl(var(--card)/0.88)_100%)]"
            ></div>
          </div>

          <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div :class="tournamentHeroToplineClasses">
              <div :class="tournamentHeroActionsClasses">
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
                    >
                      <Unlock />
                      <span>{{
                        $t("tournament.actions.open_registration")
                      }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="tournament.can_close_registration"
                      @click="closeRegistration"
                    >
                      <Lock />
                      <span>{{
                        $t("tournament.actions.close_registration")
                      }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="tournament.can_start && !tournament.can_resume"
                      @click="startTournament"
                    >
                      <Play />
                      <span>{{ $t("tournament.actions.start") }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="tournament.can_pause"
                      @click="pauseDialogOpen = true"
                    >
                      <Pause />
                      <span>{{ $t("tournament.actions.pause") }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="tournament.can_resume"
                      @click="resumeDialogOpen = true"
                    >
                      <Play />
                      <span>{{ $t("tournament.actions.resume") }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="tournament.can_setup && !leagueSeasonId"
                      @click="resetToSetup"
                    >
                      <RotateCcw />
                      <span>{{ $t("tournament.actions.reset_to_setup") }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator
                      v-if="
                        (tournament.can_open_registration ||
                          tournament.can_close_registration ||
                          tournament.can_start ||
                          (tournament.can_setup && !leagueSeasonId)) &&
                        (tournament.can_cancel || tournament.is_organizer) &&
                        !leagueSeasonId
                      "
                    />
                    <DropdownMenuItem
                      v-if="tournament.can_cancel && !leagueSeasonId"
                      @click="cancelTournament"
                      class="text-destructive"
                    >
                      <Ban />
                      <span>{{ $t("tournament.actions.cancel") }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator
                      v-if="
                        tournament.can_cancel &&
                        tournament.is_organizer &&
                        tournament.status !== e_tournament_status_enum.Live
                      "
                    />
                    <DropdownMenuItem
                      v-if="
                        tournament.is_organizer &&
                        tournament.status !== e_tournament_status_enum.Live &&
                        !leagueSeasonId
                      "
                      @click="deleteDialogOpen = true"
                      class="text-destructive"
                    >
                      <Trash2 />
                      <span>{{ $t("tournament.actions.delete") }}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div :class="tournamentHeroBodyClasses">
              <img
                v-if="tournamentLogoSrc"
                :src="tournamentLogoSrc"
                :alt="tournament.name"
                :class="tournamentHeroLogoClasses"
              />
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
                  <span
                    v-for="category in tournamentCategories"
                    :key="category"
                    :class="[
                      tournamentHeroTagClasses,
                      tournamentHeroMutedTagClasses,
                    ]"
                  >
                    {{ category }}
                  </span>
                  <a
                    v-if="tournamentHomepage"
                    :href="tournamentHomepage"
                    target="_blank"
                    rel="noopener noreferrer"
                    :class="[
                      tournamentHeroTagClasses,
                      'gap-1 no-underline transition-opacity hover:opacity-80',
                    ]"
                  >
                    <Globe class="h-3 w-3" />
                    {{ $t("tournament.form.homepage.link") }}
                  </a>
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
          </div>

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
                v-if="!tournament?.is_organizer && tournament.options"
                value="match-settings"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.page.match_settings") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="freeAgentsTabVisible"
                value="free-agents"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.free_agents.title") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="standingsTabVisible"
                value="standings"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.standings.title") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="statsTabVisible"
                value="stats"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.stats.title") }}
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
                value="information"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.page.information_tab") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="tournament?.is_organizer"
                value="prizes"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.prizes.title") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="tournament?.is_organizer"
                value="match-options"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.page.match_options_tab") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="tournament?.is_organizer"
                value="organizers"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("tournament.page.organizers_tab") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="tournament?.is_organizer"
                value="awards"
                :class="tacticalTabsTriggerClasses"
              >
                {{ $t("awards.title") }}
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

      <!-- Ahead of the entry gate, because accepting is what answers it: a
           visitor who arrived on an invite link sees the tournament first and
           accepts explicitly. -->
      <TournamentInviteAccept
        :tournament="tournament"
        :registration="tournamentRegistration"
      />

      <!-- Before the check-in panel invites them to register: whether they can
           enter at all, and which gate stops them if not. -->
      <TournamentEntryGate
        :tournament="tournament"
        :registration="tournamentRegistration"
        :already-entered="!!myTeam || !!myFreeAgent"
      />

      <!-- Directly under the hero, above every tab: a check-in deadline the
           reader scrolls past is a team that misses the bracket. -->
      <TournamentCheckInPanel
        :tournament="tournament"
        :registration="tournamentRegistration"
        :teams="checkInTeams"
        :my-team-id="myTeamId"
        :my-free-agent="myFreeAgent"
        @register="handleJoinTournament"
      />

      <TournamentCheckInReview
        v-if="checkInReviewVisible"
        :tournament="tournament"
        :registration="tournamentRegistration"
        :teams="checkInTeams"
      />

      <div
        v-if="tournament.status === e_tournament_status_enum.Paused"
        class="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {{ $t("tournament.paused_banner") }}
      </div>

      <div class="mt-6">
        <TabsContent value="overview">
          <PageTransition>
            <div class="flex flex-col gap-6">
              <TournamentStatRibbon
                :prize-pool="prizePool"
                :teams-count="teamsCount"
                :format="formatLabel"
                :start="tournament.start"
                :location="shortLocation"
              ></TournamentStatRibbon>

              <TournamentPrizes
                v-if="hasPrizes"
                :prizes="tournament.prizes"
              ></TournamentPrizes>

              <ManageSection
                v-if="tournament.description"
                :label="$t('tournament.page.about_section')"
              >
                <div class="flex flex-col gap-3">
                  <p
                    class="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-muted-foreground"
                    :class="{ 'line-clamp-[8]': !descExpanded }"
                  >
                    {{ tournament.description }}
                  </p>
                  <button
                    v-if="descLong"
                    type="button"
                    class="self-start font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] transition-opacity hover:opacity-80"
                    @click="descExpanded = !descExpanded"
                  >
                    {{
                      descExpanded
                        ? $t("tournament.page.read_less")
                        : $t("tournament.page.read_more")
                    }}
                  </button>
                </div>
              </ManageSection>

              <TournamentStageBuilder
                class="w-full"
                :tournament="tournament"
              ></TournamentStageBuilder>
            </div>
          </PageTransition>
        </TabsContent>
        <TabsContent
          value="match-settings"
          v-if="!tournament?.is_organizer && tournament.options"
        >
          <PageTransition>
            <ManageSection :label="$t('tournament.page.match_settings')">
              <MatchOptionsDisplay
                :show-details-by-default="false"
                :options="tournament.options"
              ></MatchOptionsDisplay>
            </ManageSection>
          </PageTransition>
        </TabsContent>
        <TabsContent value="my-team" v-if="myTeam">
          <PageTransition>
            <div :class="myTeamClasses">
              <div :class="myTeamHeaderClasses">
                <div :class="myTeamLabelClasses">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("tournament.page.my_team") }}
                </div>
                <div :class="myTeamHintClasses">
                  {{ $t("tournament.page.my_team_hint") }}
                </div>
              </div>

              <div :class="tournamentPanelCardClasses">
                <TournamentTeam
                  :tournament="tournament"
                  :team="myTeam"
                ></TournamentTeam>
              </div>
            </div>
          </PageTransition>
        </TabsContent>
        <TabsContent value="teams">
          <PageTransition>
            <div
              class="grid gap-6 items-start"
              :class="
                tournament.is_organizer
                  ? 'lg:grid-cols-[minmax(0,1fr)_360px]'
                  : 'grid-cols-1'
              "
            >
              <div class="min-w-0">
                <div
                  class="mb-[0.85rem] flex flex-wrap items-center justify-between gap-3"
                >
                  <!-- The organizer's tools live in the WIDE column, not the
                       360px aside. An invite list and a link list are rows of
                       names, URLs and timestamps; rows need width, and the aside
                       is the one place on this page that has none. The strip
                       stands exactly where the ROSTER label stood so the tab
                       itself is the heading — the count rides on it rather than
                       in a second label nobody would read twice.
                       size="lg" is load-bearing, not decoration: the team filter
                       to its right is another amber-indicator segmented strip,
                       and two identical ones in a single row read as one broken
                       control. Taller and bolder makes the hierarchy obvious. -->
                  <AnimatedFilters
                    v-if="tournament.is_organizer"
                    v-model="teamsPanel"
                    :options="teamsPanelTabs"
                    square
                    size="lg"
                  />

                  <!-- No tabs for a viewer: there is nothing to switch to, so
                       the page keeps the plain label it has always had. -->
                  <div v-else :class="tacticalSectionLabelClasses">
                    <span :class="tacticalSectionTickClasses"></span>
                    {{ $t("tournament.page.roster_section") }}
                    <span :class="tacticalSectionCountClasses">
                      {{ filteredTeams.length }}
                    </span>
                  </div>

                  <!-- Filtering and expand-all are roster verbs. On the Invites
                       or Links pane they would filter nothing and collapse
                       nothing, so they leave with the list they act on. -->
                  <div
                    v-if="teamsPanel === 'roster'"
                    class="flex flex-wrap items-center gap-2"
                  >
                    <AnimatedFilters
                      v-if="visibleTeams.length > 1"
                      v-model="teamFilter"
                      :options="teamFilterOptions"
                      square
                    />
                    <Button
                      v-if="visibleTeams.length > 0"
                      variant="outline"
                      size="sm"
                      class="h-8"
                      @click="toggleAllTeams"
                    >
                      <Transition
                        mode="out-in"
                        enter-active-class="transition-[opacity,transform] duration-150 ease-out motion-reduce:!duration-0"
                        leave-active-class="transition-[opacity,transform] duration-100 ease-in motion-reduce:!duration-0"
                        enter-from-class="opacity-0 scale-90 motion-reduce:scale-100"
                        leave-to-class="opacity-0 scale-90 motion-reduce:scale-100"
                      >
                        <component
                          :is="allTeamsCollapsed ? Maximize : Minimize"
                          :key="allTeamsCollapsed ? 'expand' : 'collapse'"
                          class="mr-1.5 h-4 w-4 shrink-0"
                        />
                      </Transition>
                      <!-- Both labels stacked in one grid cell reserve the wider
                           of the two, so swapping states can't resize the button. -->
                      <span class="grid">
                        <span
                          class="invisible col-start-1 row-start-1 grid"
                          aria-hidden="true"
                        >
                          <span
                            class="col-start-1 row-start-1 whitespace-nowrap"
                          >
                            {{ $t("tournament.teams_filter.collapse_all") }}
                          </span>
                          <span
                            class="col-start-1 row-start-1 whitespace-nowrap"
                          >
                            {{ $t("tournament.teams_filter.expand_all") }}
                          </span>
                        </span>
                        <Transition
                          mode="out-in"
                          enter-active-class="transition-opacity duration-150 ease-out motion-reduce:!duration-0"
                          leave-active-class="transition-opacity duration-100 ease-in motion-reduce:!duration-0"
                          enter-from-class="opacity-0"
                          leave-to-class="opacity-0"
                        >
                          <span
                            :key="allTeamsCollapsed ? 'expand' : 'collapse'"
                            class="col-start-1 row-start-1 whitespace-nowrap text-center"
                          >
                            {{
                              allTeamsCollapsed
                                ? $t("tournament.teams_filter.expand_all")
                                : $t("tournament.teams_filter.collapse_all")
                            }}
                          </span>
                        </Transition>
                      </span>
                    </Button>
                  </div>
                </div>

                <!-- Panes are v-show, never v-if: each invite pane owns a live
                     subscription whose row count is the badge on its own tab,
                     and TournamentInviteLinks holds the organizer's unsubmitted
                     expiry/max-uses choice. Unmounting would zero both — the
                     badge would only ever be right for the tab you are already
                     looking at, which is the one tab that does not need it.
                     HeightMorph exists for exactly this: it tweens the frame
                     across a swap it does not control. -->
                <HeightMorph :state="teamsPanel">
                  <div v-show="teamsPanel === 'roster'">
                    <FadeSwap>
                      <div
                        v-if="visibleTeams.length === 0"
                        key="no-teams"
                        class="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground"
                      >
                        {{ $t("tournament.page.no_teams_yet") }}
                      </div>

                      <div
                        v-else-if="filteredTeams.length === 0"
                        key="no-matches"
                        class="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground"
                      >
                        {{ $t("tournament.teams_filter.no_matches") }}
                      </div>

                      <TransitionGroup
                        v-else
                        key="teams"
                        tag="div"
                        class="flex flex-col gap-4"
                        enter-active-class="transition-[opacity,transform] [transition-duration:420ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,transform] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"
                        enter-from-class="opacity-0 translate-y-3 motion-reduce:translate-y-0"
                        leave-active-class="absolute w-full transition-[opacity,transform] duration-200 ease-in motion-reduce:![transition-duration:1ms]"
                        leave-to-class="opacity-0 -translate-y-2 motion-reduce:translate-y-0"
                        move-class="transition-transform duration-300 ease-out motion-reduce:!transition-none"
                        @before-enter="setTeamEnterDelay"
                        @after-enter="clearTeamEnterDelay"
                        @enter-cancelled="clearTeamEnterDelay"
                      >
                        <div
                          v-for="(team, index) of filteredTeams"
                          :key="team.id"
                          :data-stagger="Math.min(index, 12)"
                          :class="tournamentTeamCardClasses"
                        >
                          <TournamentTeam
                            :tournament="tournament"
                            :team="team"
                            :collapsible="true"
                            :collapsed="collapsedTeams.has(team.id)"
                            @toggle-collapsed="toggleTeamCollapsed(team.id)"
                          ></TournamentTeam>
                        </div>
                      </TransitionGroup>
                    </FadeSwap>
                  </div>

                  <!-- v-if on the ROLE, v-show on the TAB. A viewer must never
                       mount these at all (they are organizer-only
                       subscriptions); an organizer must never unmount them. -->
                  <template v-if="tournament.is_organizer">
                    <div
                      v-show="teamsPanel === 'invites'"
                      :class="tournamentPanelCardClasses"
                    >
                      <TournamentInvites
                        :tournament="tournament"
                        :registration="tournamentRegistration"
                        @count="adminInviteCount = $event"
                      />
                    </div>

                    <div
                      v-show="teamsPanel === 'links'"
                      :class="tournamentPanelCardClasses"
                    >
                      <TournamentInviteLinks
                        :tournament="tournament"
                        @count="adminLinkCount = $event"
                      />
                    </div>
                  </template>
                </HeightMorph>
              </div>

              <!-- The aside is back to its one job: put a team in the bracket.
                   `sticky` is kept precisely because the panel is short again —
                   a column taller than the viewport cannot follow anyone
                   anywhere, which is why it was wrong while three tools were
                   stacked here. Beside a roster of thirty teams, a short Add
                   Team frame that stays in reach is the whole point. -->
              <div v-if="tournament.is_organizer" class="lg:sticky lg:top-6">
                <PageTransition :delay="150">
                  <aside :class="tournamentAdminPanelClasses">
                    <section :class="tournamentAdminSectionClasses">
                      <div :class="[tacticalSectionLabelClasses, 'mb-0']">
                        <span :class="tacticalSectionTickClasses"></span>
                        {{ $t("tournament.add_team.title") }}
                      </div>
                      <p :class="tournamentAdminSectionHintClasses">
                        {{ $t("tournament.add_team.description") }}
                      </p>
                      <TournamentJoinForm
                        :tournament="tournament"
                      ></TournamentJoinForm>
                    </section>
                  </aside>
                </PageTransition>
              </div>
            </div>
          </PageTransition>
        </TabsContent>
        <TabsContent v-if="freeAgentsTabVisible" value="free-agents">
          <PageTransition>
            <TournamentFreeAgents :tournament="tournament" />
          </PageTransition>
        </TabsContent>
        <TabsContent v-if="standingsTabVisible" value="standings">
          <PageTransition>
            <TournamentResults
              :tournament="tournament"
              :show-standings="true"
              :show-matches="false"
            />
          </PageTransition>
        </TabsContent>
        <TabsContent v-if="statsTabVisible" value="stats">
          <PageTransition>
            <TournamentStats :tournament="tournament" />
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
        <TabsContent value="information" v-if="tournament?.is_organizer">
          <PageTransition>
            <TournamentInformationForm :tournament="tournament" />
          </PageTransition>
        </TabsContent>
        <TabsContent value="match-options" v-if="tournament?.is_organizer">
          <PageTransition>
            <TournamentMatchOptionsForm :tournament="tournament" />
          </PageTransition>
        </TabsContent>
        <TabsContent value="prizes" v-if="tournament?.is_organizer">
          <PageTransition>
            <TournamentPrizesManage :tournament="tournament" />
          </PageTransition>
        </TabsContent>
        <TabsContent value="organizers" v-if="tournament?.is_organizer">
          <PageTransition>
            <TournamentOrganizers
              :tournament="tournament"
            ></TournamentOrganizers>
          </PageTransition>
        </TabsContent>
        <TabsContent value="awards" v-if="tournament?.is_organizer">
          <PageTransition>
            <div class="flex flex-col gap-4">
              <TournamentAwardsConfig :tournament="tournament" />
              <TournamentAwardsManage :tournament="tournament" />
            </div>
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
import { playerFields } from "~/graphql/playerFields";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { formatPrizePool } from "~/utilities/prizePool";
import {
  getRequestedRouteTab,
  getRouteTabValue,
  normalizeRouteTab,
  replaceRouteTab,
} from "~/composables/useRouteTab";

export default {
  data() {
    return {
      myTeam: undefined,
      // Typed rather than left to infer `undefined`: a bare `undefined` narrows
      // to `never`, and every `tournament.x` in this file's 1000-line template
      // then type-errors on a value that is plainly an object at runtime.
      tournament: undefined as Record<string, any> | undefined,
      tournamentRegistration: null as Record<string, any> | null,
      checkInTeams: [] as Array<Record<string, any>>,
      myFreeAgent: null as Record<string, any> | null,
      tournamentDialog: false,
      teamSearchQuery: undefined,
      settingsDialogOpen: false,
      organizersDialogOpen: false,
      joinSheetOpen: false,
      descExpanded: false,
      deleteDialogOpen: false,
      pauseDialogOpen: false,
      resumeDialogOpen: false,
      organizerPopoversOpen: {},
      activeTab: "overview",
      // Which pane the wide column of the Teams tab is showing. Organizer-only
      // in the UI, but always "roster" for everyone else, so every v-show below
      // reads true for a viewer without a second code path.
      teamsPanel: "roster",
      // Reported up by the two panels rather than counted here: they already
      // hold the live subscriptions, and a second aggregate subscription just
      // to badge a tab would be a socket paying for a number we already have.
      adminInviteCount: 0,
      adminLinkCount: 0,
      teamFilter: "all",
      collapsedTeams: new Set(),
      myTeamLoaded: false,
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
              scheduling_mode: true,
              awards_enabled: true,
              e_tournament_status: {
                description: true,
              },
              description: true,
              logo: true,
              banner: true,
              homepage: true,
              location: true,
              latitude: true,
              longitude: true,
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
              organizer_teams: [
                {},
                {
                  team_id: true,
                  team: {
                    id: true,
                    name: true,
                    short_name: true,
                    avatar_url: true,
                  },
                },
              ],
              categories: [
                {},
                {
                  category: true,
                  e_tournament_category: {
                    value: true,
                    description: true,
                  },
                },
              ],
              prizes: [
                {
                  order_by: [
                    {
                      order: order_by.asc,
                    },
                  ],
                },
                {
                  id: true,
                  place: true,
                  prize: true,
                  order: true,
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
              awards: [
                {},
                {
                  id: true,
                  placement: true,
                  placement_tier: true,
                  tournament_team_id: true,
                  player_steam_id: true,
                  team_id: true,
                  source: true,
                  note: true,
                  award_id: true,
                  award: {
                    id: true,
                    name: true,
                    tier: true,
                    silhouette: true,
                    image_url: true,
                  },
                  player: playerFields,
                  team: {
                    id: true,
                    name: true,
                    short_name: true,
                  },
                  tournament_team: {
                    id: true,
                    name: true,
                    team: {
                      id: true,
                      name: true,
                    },
                    roster: [
                      {},
                      {
                        player_steam_id: true,
                        player: playerFields,
                      },
                    ],
                  },
                },
              ],
              award_configs: [
                {},
                {
                  id: true,
                  tournament_id: true,
                  placement: true,
                  award_id: true,
                  custom_name: true,
                  silhouette: true,
                  image_url: true,
                  award: {
                    id: true,
                    name: true,
                    tier: true,
                    silhouette: true,
                    image_url: true,
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
                  max_rounds: true,
                  swiss_no_elimination: true,
                  decider_best_of: true,
                  default_best_of: true,
                  final_map_advantage: true,
                  settings: true,
                  third_place_match: true,
                  options: matchOptionsFields,
                  results: [
                    {},
                    {
                      tournament_team_id: true,
                      group_number: true,
                      rank: true,
                      placement: true,
                      wins: true,
                      losses: true,
                      rounds_won: true,
                      rounds_lost: true,
                      maps_won: true,
                      maps_lost: true,
                      matches_played: true,
                      matches_remaining: true,
                      team: {
                        id: true,
                        name: true,
                        team: {
                          id: true,
                          name: true,
                          avatar_url: true,
                        },
                        roster: [
                          {},
                          {
                            role: true,
                            player: playerFields,
                          },
                        ],
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
                      // Heavy match fields are fetched by TournamentResults.vue.
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
                      options: {
                        best_of: true,
                      },
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
                        winning_lineup_id: true,
                        lineup_1_id: true,
                        lineup_2_id: true,
                        options: {
                          best_of: true,
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
                            lineup_1_score: true,
                            lineup_2_score: true,
                            winning_lineup_id: true,
                            order: true,
                            status: true,
                          },
                        ],
                        lineup_1: {
                          id: true,
                          name: true,
                          team_id: true,
                        },
                        lineup_2: {
                          id: true,
                          name: true,
                          team_id: true,
                        },
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
      // Deliberately separate from the main tournament subscription: these
      // columns only exist after the registration/check-in migration, and a
      // field the server has never heard of fails the whole document. Kept
      // apart, a stack that has not migrated yet loses the check-in surfaces
      // and nothing else.
      tournamentRegistration: {
        query: generateSubscription({
          tournaments_by_pk: [
            {
              id: $("tournamentId", "uuid!"),
            },
            {
              id: true,
              registration_type: true,
              invite_only: true,
              min_role: true,
              min_elo: true,
              max_elo: true,
              // The two gates a would-be entrant hits: the role floor (server
              // truth, session-scoped) and whether invite-only has been
              // unlocked for them. Without both, "Join" is offered and then
              // fails with a raw Hasura error.
              meets_min_role: true,
              registration_unlocked: true,
              check_in_required: true,
              check_in_setting: true,
              check_in_opens_before_minutes: true,
              check_in_closes_before_minutes: true,
              check_in_ends_at: true,
              check_in_open: true,
              check_in_started: true,
              can_review_check_in: true,
              missed_check_in_count: true,
            },
          ],
          // Zeus types for the new columns land with `yarn codegen`; until
          // then the selection is asserted rather than inferred.
        } as any),
        variables: function (this: any) {
          return {
            tournamentId: this.$route.params.tournamentId,
          };
        },
        result: function (this: any, { data }: { data: any }) {
          this.tournamentRegistration = data?.tournaments_by_pk ?? null;
        },
      },
      // Only ever opened for a tournament that actually requires check-in —
      // it duplicates the roster the main subscription already carries, and
      // the 99% of tournaments with check-in off should not pay for it.
      checkInTeams: {
        query: generateSubscription({
          tournament_teams: [
            {
              where: {
                tournament_id: {
                  _eq: $("tournamentId", "uuid!"),
                },
              },
              order_by: [
                {
                  created_at: order_by.asc,
                },
              ],
            },
            {
              id: true,
              name: true,
              short_name: true,
              created_at: true,
              checked_in_at: true,
              owner_steam_id: true,
              captain_steam_id: true,
              // can_manage_tournament_team: the exact predicate the check-in
              // action accepts. Re-deriving it from captain/owner locks out a
              // roster Admin the API would have let through.
              can_manage: true,
              team: {
                id: true,
                name: true,
                short_name: true,
                avatar_url: true,
              },
              roster: [
                {},
                {
                  player_steam_id: true,
                  role: true,
                  checked_in_at: true,
                  player: playerFields,
                },
              ],
              roster_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
                },
              ],
            },
          ],
        } as any),
        variables: function (this: any) {
          return {
            tournamentId: this.$route.params.tournamentId,
          };
        },
        skip: function (this: any): boolean {
          return this.tournamentRegistration?.check_in_required !== true;
        },
        result: function (this: any, { data }: { data: any }) {
          this.checkInTeams = data?.tournament_teams ?? [];
        },
      },
      // An undrafted free agent has no tournament_teams row at all, so every
      // team-shaped check-in surface misses them — while the check-in job
      // still pushes them "confirm your spot". This row is what lets them.
      myFreeAgent: {
        query: generateSubscription({
          tournament_free_agents: [
            {
              where: {
                tournament_id: {
                  _eq: $("tournamentId", "uuid!"),
                },
                player_steam_id: {
                  _eq: $("steamId", "bigint!"),
                },
              },
            },
            {
              id: true,
              status: true,
              checked_in_at: true,
              tournament_team_id: true,
            },
          ],
        }),
        variables: function (this: any) {
          return {
            tournamentId: this.$route.params.tournamentId,
            steamId: this.me?.steam_id,
          };
        },
        skip: function (this: any): boolean {
          return !this.me?.steam_id || !this.freeAgentsTabVisible;
        },
        result: function (this: any, { data }: { data: any }) {
          this.myFreeAgent = data?.tournament_free_agents?.[0] ?? null;
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
          this.myTeamLoaded = true;
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
    leagueSeasonId() {
      return this.$route.params.seasonId ?? null;
    },
    tournamentLogoSrc() {
      if (!this.tournament?.logo) {
        return null;
      }
      return `https://${useRuntimeConfig().public.apiDomain}/${this.tournament.logo}`;
    },
    tournamentBannerSrc() {
      if (!this.tournament?.banner) {
        return null;
      }
      return `https://${useRuntimeConfig().public.apiDomain}/${this.tournament.banner}`;
    },
    tournamentCategories() {
      return (this.tournament?.categories ?? []).map((category) => {
        return category.e_tournament_category?.description ?? category.category;
      });
    },
    tournamentHomepage() {
      const homepage = this.tournament?.homepage;
      if (!homepage) {
        return null;
      }
      return /^https?:\/\//.test(homepage) ? homepage : `https://${homepage}`;
    },
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
    prizePool() {
      return formatPrizePool(this.tournament?.prizes);
    },
    hasPrizes() {
      return (this.tournament?.prizes?.length ?? 0) > 0;
    },
    shortLocation() {
      const loc = this.tournament?.location;
      if (!loc) {
        return null;
      }
      // Keep the readable address parts ("Sandberg, Colmberg, Bavaria,
      // Germany"), dropping only postal-code segments.
      const parts = loc
        .split(",")
        .map((part: string) => part.trim())
        .filter((part: string) => part && !/^\d[\d\s-]*$/.test(part));
      return parts.length > 0 ? parts.join(", ") : loc;
    },
    descLong() {
      return (this.tournament?.description?.length ?? 0) > 280;
    },
    teamsCount() {
      return this.tournament?.teams_aggregate?.aggregate?.count ?? 0;
    },
    formatLabel() {
      if (this.singleStageTypeWithBestOf) {
        return this.singleStageTypeWithBestOf;
      }
      if (this.stageCount > 1) {
        return `${this.stageCount} ${this.$t("tournament.stage.stages")}`;
      }
      return this.tournament?.options?.type ?? null;
    },
    e_tournament_status_enum() {
      return e_tournament_status_enum;
    },
    tournamentHasStarted() {
      const status = this.tournament?.status;
      if (!status) return false;
      return ![
        e_tournament_status_enum.Setup,
        e_tournament_status_enum.RegistrationOpen,
        e_tournament_status_enum.RegistrationClosed,
        // Nothing is seeded while the tournament is held for review, but
        // re-admitting one team re-runs assign_seeds_to_teams, which nulls
        // eligible_at for every team still missing a check-in. Treating the
        // hold as "started" would filter those teams off the Teams tab even
        // though they are still registered with a full roster.
        e_tournament_status_enum.CheckInReview,
      ].includes(status);
    },
    visibleTeams() {
      const teams = this.tournament?.teams || [];
      const visible = this.tournamentHasStarted
        ? teams.filter((team) => !!team.eligible_at)
        : teams;

      // tournament_team_invites is only selectable by the `user` role, so the
      // public teams query can't ask for invites. Swap in the myTeam copy,
      // which carries them, so pending invites show on this tab too.
      if (!this.myTeam) return visible;
      return visible.map((team) =>
        team.id === this.myTeam.id ? this.myTeam : team,
      );
    },
    incompleteTeams() {
      return this.visibleTeams.filter((team) => !team.eligible_at);
    },
    // Return type spelled out because `tournament.teams` is `any`: without it
    // the v-for index below widens to `string | number` (the object-iteration
    // signature) and every numeric use of it fails to type-check.
    filteredTeams(): Array<Record<string, any>> {
      if (this.teamFilter === "incomplete") return this.incompleteTeams;
      if (this.teamFilter === "ready") {
        return this.visibleTeams.filter((team) => !!team.eligible_at);
      }
      return this.visibleTeams;
    },
    teamFilterOptions() {
      const incomplete = this.incompleteTeams.length;
      return [
        {
          key: "all",
          label: this.$t("tournament.teams_filter.all"),
          count: this.visibleTeams.length,
        },
        {
          key: "ready",
          label: this.$t("tournament.teams_filter.ready"),
          count: this.visibleTeams.length - incomplete,
        },
        {
          key: "incomplete",
          label: this.$t("tournament.teams_filter.incomplete"),
          count: incomplete,
        },
      ];
    },
    // Every badge counts exactly what its own pane lists, which is why Roster
    // carries the FILTERED total rather than the registered one: the number on
    // the tab and the number of cards under it can then never disagree, and the
    // per-filter breakdown is already on the chip strip beside it.
    teamsPanelTabs() {
      return [
        {
          key: "roster",
          label: this.$t("tournament.page.roster_section"),
          count: this.filteredTeams.length,
        },
        {
          key: "invites",
          label: this.$t("tournament.invites.title"),
          count: this.adminInviteCount,
        },
        {
          key: "links",
          label: this.$t("tournament.invite_links.tab"),
          count: this.adminLinkCount,
        },
      ];
    },
    allTeamsCollapsed() {
      const teams = this.filteredTeams;
      if (teams.length === 0) return false;
      return teams.every((team) => this.collapsedTeams.has(team.id));
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
      // Held for an organizer, not running and not cancelled — the warning
      // tier is the one that reads as "this needs a decision".
      if (s === e_tournament_status_enum.CheckInReview) return "paused";
      if (s === e_tournament_status_enum.Finished) return "finished";
      if (
        s === e_tournament_status_enum.Cancelled ||
        s === e_tournament_status_enum.CancelledMinTeams
      ) {
        return "ended";
      }
      return "neutral";
    },
    availableTournamentTabs() {
      const tabs = ["overview"];

      if (this.myTeam) {
        tabs.push("my-team");
      }

      tabs.push("teams");

      if (!this.tournament?.is_organizer && this.tournament?.options) {
        tabs.push("match-settings");
      }

      if (this.freeAgentsTabVisible) {
        tabs.push("free-agents");
      }

      if (this.standingsTabVisible) {
        tabs.push("standings");
      }

      if (this.statsTabVisible) {
        tabs.push("stats");
      }

      if (
        this.tournament?.status === e_tournament_status_enum.Live ||
        this.tournament?.status === e_tournament_status_enum.Finished
      ) {
        tabs.push("results");
      }

      if (this.tournament?.is_organizer) {
        tabs.push(
          "information",
          "prizes",
          "match-options",
          "organizers",
          "awards",
          "notifications",
        );
      }

      return tabs;
    },
    standingsTabVisible() {
      const status = this.tournament?.status;
      return (
        status === e_tournament_status_enum.Live ||
        status === e_tournament_status_enum.Paused ||
        status === e_tournament_status_enum.Finished
      );
    },
    freeAgentsTabVisible() {
      const type = this.tournamentRegistration?.registration_type;
      return type === "free_agents" || type === "both";
    },
    // The leaderboard has nothing in it until maps have been played, which is
    // exactly when standings become meaningful too.
    statsTabVisible() {
      return this.standingsTabVisible;
    },
    // can_review_check_in already answers "is this session allowed to act on
    // the hold"; the status check keeps the panel off every other screen.
    checkInReviewVisible() {
      const tournament = this.tournament as Record<string, any> | undefined;
      return (
        tournament?.status === e_tournament_status_enum.CheckInReview &&
        (this.tournamentRegistration?.can_review_check_in === true ||
          tournament?.is_organizer === true)
      );
    },
    myTeamId() {
      return (this.myTeam as Record<string, any> | undefined)?.id ?? null;
    },
  },
  methods: {
    toggleTeamCollapsed(teamId) {
      if (this.collapsedTeams.has(teamId)) {
        this.collapsedTeams.delete(teamId);
        return;
      }
      this.collapsedTeams.add(teamId);
    },
    toggleAllTeams() {
      if (this.allTeamsCollapsed) {
        for (const team of this.filteredTeams) {
          this.collapsedTeams.delete(team.id);
        }
        return;
      }
      for (const team of this.filteredTeams) {
        this.collapsedTeams.add(team.id);
      }
    },
    syncActiveTabFromRoute() {
      if (!this.tournament) {
        return;
      }

      const requestedTab = getRequestedRouteTab(this.$route.query);
      if (requestedTab === "my-team" && this.me && !this.myTeamLoaded) {
        return;
      }

      const activeTab = getRouteTabValue(
        this.$route,
        this.availableTournamentTabs,
        "overview",
      );

      if (this.activeTab !== activeTab) {
        this.activeTab = activeTab;
      }

      void normalizeRouteTab(
        this.$router,
        this.$route,
        this.availableTournamentTabs,
        "overview",
      );
    },
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
    activeTab(newTab) {
      if (!this.tournament || !this.availableTournamentTabs.includes(newTab)) {
        return;
      }

      void replaceRouteTab(this.$router, this.$route, newTab, "overview");
    },
    "$route.query.tab"() {
      this.syncActiveTabFromRoute();
    },
    availableTournamentTabs() {
      this.syncActiveTabFromRoute();
    },
    tournament: {
      handler(newTournament) {
        if (newTournament) {
          this.syncActiveTabFromRoute();
        }
      },
      immediate: true,
    },
    organizersList: {
      handler(newList) {
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
