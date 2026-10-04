<script lang="ts" setup>
import { computed } from "vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TournamentStageBuilder from "~/components/tournament/TournamentStageBuilder.vue";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";
import TournamentPrizes from "~/components/tournament/TournamentPrizes.vue";
import TournamentManage from "~/components/tournament/TournamentManage.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import TournamentStatRibbon from "~/components/tournament/TournamentStatRibbon.vue";
import TournamentResults from "~/components/tournament/TournamentResults.vue";
import TournamentCheckInPanel from "~/components/tournament/TournamentCheckInPanel.vue";
import TournamentCheckInReview from "~/components/tournament/TournamentCheckInReview.vue";
import TournamentEntryGate from "~/components/tournament/TournamentEntryGate.vue";
import TournamentFreeAgents from "~/components/tournament/TournamentFreeAgents.vue";
import TournamentInviteAccept from "~/components/tournament/TournamentInviteAccept.vue";
import TournamentStats from "~/components/tournament/TournamentStats.vue";
import TournamentDetailSkeleton from "~/components/tournament/TournamentDetailSkeleton.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchOptionsDisplay from "~/components/match/MatchOptionsDisplay.vue";
import {
  Settings,
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
  MessageSquare,
  CalendarDays,
  Layers,
  ChevronDown,
} from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
  DropdownMenuLabel,
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
import AnimatedStat from "~/components/AnimatedStat.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { Fold } from "~/components/ui/transitions";
import { useTournamentPreviews } from "~/composables/useTournamentPreview";

import {
  tacticalCtaButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";

const route = useRoute();
const tournamentPreviews = useTournamentPreviews();
const tournamentPreview = computed(
  () => tournamentPreviews.value[String(route.params.tournamentId)] ?? null,
);

// One surface: the banner as a band on top (never text over the image, so any
// artwork works), identity and actions under it, the tab row at the foot.
const tournamentHeroClasses =
  "overflow-hidden rounded-xl border border-border bg-card/40";
const tournamentBannerClasses =
  "aspect-[5/2] max-h-[18.75rem] w-full bg-muted/40 sm:aspect-[4/1]";
const tournamentHeroBodyClasses =
  "flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-5 pt-5 max-sm:px-4 max-sm:pt-4";
const tournamentHeroLogoClasses =
  "h-14 w-14 shrink-0 rounded-md border border-border bg-muted/30 object-contain sm:h-16 sm:w-16";
const tournamentHeroNameClasses =
  "m-0 text-[clamp(1.5rem,3.4vw,2.25rem)] font-extrabold leading-[1.05] [text-wrap:balance]";
const tournamentHeroTagClasses =
  "inline-flex h-6 items-center rounded-md border border-border bg-muted/30 px-2 text-xs font-semibold text-muted-foreground";
const tournamentHeroMetaClasses =
  "flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[0.8rem] text-muted-foreground";
const tournamentHeroOrganizerClasses =
  "inline-flex cursor-pointer transition-[opacity,transform] duration-150 hover:-translate-y-px hover:opacity-85";
const tournamentHeroActionsClasses =
  "flex flex-wrap items-center gap-2 max-sm:w-full";
const tournamentHeroStatusClasses =
  "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-xs font-semibold";
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
  "h-9 px-4 py-2 text-[0.68rem] tracking-[0.14em] max-sm:basis-full",
];
const tournamentHeroTabsClasses = "mt-4 border-t border-border px-2 sm:px-3";
const tournamentTabTriggerClasses = [
  tacticalTabsTriggerClasses,
  "h-11 shrink-0",
];
const tournamentChatRoomUnreadClasses =
  "inline-flex h-4 min-w-[1rem] origin-center items-center justify-center rounded-full bg-red-500 px-1 font-sans text-[0.6rem] font-bold leading-none tracking-normal text-white tabular-nums";
const chatRoomUnreadPopTransition = {
  enterActiveClass:
    "[transition:transform_0.3s_cubic-bezier(0.34,1.56,0.64,1),opacity_0.2s_ease] motion-reduce:[transition:none]",
  enterFromClass: "scale-0 opacity-0",
  leaveActiveClass:
    "[transition:transform_0.15s_ease-in,opacity_0.15s_ease-in] motion-reduce:[transition:none]",
  leaveToClass: "scale-0 opacity-0",
};
const tacticalSectionCountClasses =
  "rounded-full border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] px-[0.45rem] py-[0.05rem] text-[0.62rem] tracking-[0.08em] text-[hsl(var(--tac-amber))]";
const tournamentTeamCardClasses =
  "rounded-lg border border-border bg-card/45 px-5 py-4 [backdrop-filter:blur(6px)] transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.35)] hover:bg-card/60";

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
  <!-- A header-shaped skeleton (seeded from the list you came from) holds the
       page while its queries land, then dissolves into it: no blank wait. -->
  <FadeSwap>
    <div v-if="tournament" key="tournament">
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
            <div v-if="tournamentBannerSrc" :class="tournamentBannerClasses">
              <img
                :src="tournamentBannerSrc"
                alt=""
                class="h-full w-full object-cover object-[50%_40%]"
              />
            </div>

            <div :class="tournamentHeroBodyClasses">
              <div class="flex min-w-0 items-start gap-4">
                <img
                  v-if="tournamentLogoSrc"
                  :src="tournamentLogoSrc"
                  :alt="tournament.name"
                  :class="tournamentHeroLogoClasses"
                />
                <div class="grid min-w-0 gap-2">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      :class="[
                        tournamentHeroStatusClasses,
                        tournamentHeroStatusTierClasses[statusTier] ??
                          tournamentHeroStatusTierClasses.ended,
                      ]"
                    >
                      <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
                      {{ tournament.e_tournament_status.description }}
                    </span>
                    <span :class="tournamentHeroTagClasses">
                      {{ tournament.options.type }}
                    </span>
                    <span
                      v-for="category in tournamentCategories"
                      :key="category"
                      :class="tournamentHeroTagClasses"
                    >
                      {{ category }}
                    </span>
                  </div>
                  <h1 :class="tournamentHeroNameClasses">
                    {{ tournament.name }}
                  </h1>
                  <div :class="tournamentHeroMetaClasses">
                    <span class="inline-flex items-center gap-1.5">
                      <CalendarDays class="h-3.5 w-3.5" />
                      {{ startLabel }}
                    </span>
                    <span
                      v-if="shortLocation"
                      class="inline-flex items-center gap-1.5"
                    >
                      <MapPin class="h-3.5 w-3.5" />
                      {{ shortLocation }}
                    </span>
                    <span
                      v-if="formatLabel"
                      class="inline-flex items-center gap-1.5"
                    >
                      <Layers class="h-3.5 w-3.5" />
                      {{ formatLabel }}
                    </span>
                    <a
                      v-if="tournamentHomepage"
                      :href="tournamentHomepage"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1.5 underline decoration-muted-foreground/40 underline-offset-[3px] transition-colors hover:text-foreground"
                    >
                      <Globe class="h-3.5 w-3.5" />
                      {{ $t("tournament.form.homepage.link") }}
                    </a>
                    <span class="inline-flex items-center gap-1">
                      <template
                        v-for="(organizer, index) in organizersList.slice(0, 6)"
                        :key="organizer.steam_id"
                      >
                        <Popover v-model:open="organizerPopoversOpen[index]">
                          <PopoverTrigger as-child>
                            <button
                              type="button"
                              :class="tournamentHeroOrganizerClasses"
                              :aria-label="organizer.name"
                              @mouseenter="organizerPopoversOpen[index] = true"
                              @mouseleave="organizerPopoversOpen[index] = false"
                            >
                              <Avatar shape="square" class="h-6 w-6">
                                <AvatarImage
                                  v-if="organizer?.avatar_url"
                                  :src="organizer.avatar_url"
                                  :alt="organizer.name"
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
                      <span
                        v-if="organizersList.length > 6"
                        class="ml-1 text-xs tabular-nums"
                      >
                        +{{ organizersList.length - 6 }}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div :class="tournamentHeroActionsClasses">
                <Button
                  v-if="
                    tournament.status ===
                      e_tournament_status_enum.RegistrationOpen &&
                    tournament.can_join
                  "
                  :class="tournamentHeroJoinButtonClasses"
                  @click="handleJoinTournament"
                >
                  <UserPlus class="h-4 w-4" />
                  {{ $t("tournament.join.title") }}
                </Button>

                <Button
                  v-if="chatRoomTournament"
                  variant="outline"
                  class="relative"
                  @click="openChatRoom"
                >
                  <MessageSquare class="h-4 w-4 shrink-0" />
                  <span class="max-sm:sr-only">
                    {{ $t("tournament.page.chat_room_tab") }}
                  </span>
                  <Transition v-bind="chatRoomUnreadPopTransition">
                    <span
                      v-if="chatRoomUnreadLabel"
                      :class="tournamentChatRoomUnreadClasses"
                    >
                      <AnimatedStat :value="chatRoomUnreadLabel" />
                    </span>
                  </Transition>
                </Button>

                <!-- Manage opens the console; the attached menu holds the
                   status actions that used to hide behind the gear. -->
                <ButtonGroup v-if="tournament?.is_organizer">
                  <Button
                    variant="outline"
                    :class="
                      activeTab === 'manage' &&
                      'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.1)] text-foreground'
                    "
                    :aria-pressed="activeTab === 'manage'"
                    @click="toggleManage"
                  >
                    <Settings class="h-4 w-4" />
                    {{ $t("tournament.manage.button") }}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="outline"
                        size="icon"
                        :aria-label="$t('tournament.manage.status_actions')"
                      >
                        <ChevronDown class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent class="w-60" align="end">
                      <DropdownMenuLabel>
                        {{ $t("tournament.manage.status_actions") }}
                      </DropdownMenuLabel>
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
                        <span>{{
                          $t("tournament.actions.reset_to_setup")
                        }}</span>
                      </DropdownMenuItem>
                      <template v-if="!leagueSeasonId">
                        <DropdownMenuSeparator
                          v-if="
                            tournament.can_cancel ||
                            tournament.status !== e_tournament_status_enum.Live
                          "
                        />
                        <DropdownMenuItem
                          v-if="tournament.can_cancel"
                          class="text-destructive"
                          @click="cancelTournament"
                        >
                          <Ban />
                          <span>{{ $t("tournament.actions.cancel") }}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="
                            tournament.status !== e_tournament_status_enum.Live
                          "
                          class="text-destructive"
                          @click="deleteDialogOpen = true"
                        >
                          <Trash2 />
                          <span>{{ $t("tournament.actions.delete") }}</span>
                        </DropdownMenuItem>
                      </template>
                      <p
                        v-if="!hasStatusActions"
                        class="px-2 py-1.5 text-xs text-muted-foreground"
                      >
                        {{ $t("tournament.manage.no_status_actions") }}
                      </p>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ButtonGroup>
              </div>
            </div>

            <div :class="tournamentHeroTabsClasses">
              <div
                v-if="activeTab === 'manage'"
                class="flex min-h-11 flex-wrap items-center justify-between gap-2 py-1.5"
              >
                <span class="text-sm font-semibold">
                  {{ $t("tournament.manage.title") }}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="activeTab = 'overview'"
                >
                  <ArrowLeft class="h-4 w-4" />
                  {{ $t("tournament.manage.back") }}
                </Button>
              </div>
              <TabsList
                v-else
                variant="underline"
                class="h-auto min-w-0 flex-nowrap justify-start overflow-x-auto bg-transparent p-0 [scrollbar-width:none]"
              >
                <TabsTrigger
                  v-for="tab in publicTabs"
                  :key="tab.value"
                  :value="tab.value"
                  :class="tournamentTabTriggerClasses"
                >
                  {{ tab.label }}
                </TabsTrigger>
              </TabsList>
            </div>
          </header>
        </PageTransition>

        <!-- Held until registration and your own team/free-agent rows are in:
           drawn earlier, the check-in panel shows "register" and then swaps. -->
        <Fold :open="activeTab !== 'manage' && participantReady">
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

          <!-- Directly under the header, above every tab: a check-in deadline the
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
        </Fold>

        <div
          v-if="tournament.status === e_tournament_status_enum.Paused"
          class="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {{ $t("tournament.paused_banner") }}
        </div>

        <div class="mt-6">
          <TabsContent value="overview">
            <PageTransition>
              <div class="flex flex-col gap-8">
                <TournamentStatRibbon
                  :prize-pool="prizePool"
                  :teams-count="teamsCount"
                  :format="formatLabel"
                  :start="tournament.start"
                  :location="shortLocation"
                ></TournamentStatRibbon>

                <TournamentResults
                  v-if="standingsTabVisible"
                  :tournament="tournament"
                  :show-standings="true"
                  :show-matches="false"
                />

                <TournamentPrizes
                  v-if="hasPrizes"
                  :prizes="tournament.prizes"
                ></TournamentPrizes>

                <div class="grid items-start gap-8 xl:grid-cols-2">
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
                        class="self-start text-xs font-semibold text-[hsl(var(--tac-amber))] transition-opacity hover:opacity-80"
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

                  <ManageSection
                    v-if="tournament.options"
                    :label="$t('tournament.page.match_settings')"
                  >
                    <MatchOptionsDisplay
                      :show-details-by-default="false"
                      :options="tournament.options"
                      :substitutes="
                        tournament.max_players_per_lineup -
                        tournament.min_players_per_lineup
                      "
                    ></MatchOptionsDisplay>
                  </ManageSection>
                </div>
              </div>
            </PageTransition>
          </TabsContent>

          <TabsContent value="bracket">
            <PageTransition>
              <TournamentStageBuilder
                class="w-full"
                :tournament="tournament"
                :manage="false"
              >
                <template #empty-action>
                  <Button
                    v-if="tournament.is_organizer"
                    variant="outline"
                    size="sm"
                    @click="openManage('stages')"
                  >
                    <Layers class="h-4 w-4" />
                    {{ $t("tournament.manage.set_up_stages") }}
                  </Button>
                </template>
              </TournamentStageBuilder>
            </PageTransition>
          </TabsContent>

          <TabsContent v-if="matchesTabVisible" value="matches">
            <PageTransition>
              <TournamentResults
                :tournament="tournament"
                :show-standings="false"
                :show-matches="true"
              />
            </PageTransition>
          </TabsContent>

          <TabsContent value="teams">
            <PageTransition>
              <div class="grid gap-8">
                <ManageSection
                  v-if="myTeam"
                  :label="$t('tournament.page.my_team')"
                  :hint="$t('tournament.page.my_team_hint')"
                >
                  <div :class="tournamentTeamCardClasses">
                    <TournamentTeam
                      :tournament="tournament"
                      :team="myTeam"
                    ></TournamentTeam>
                  </div>
                </ManageSection>

                <div class="min-w-0">
                  <div
                    class="mb-[0.85rem] flex flex-wrap items-center justify-between gap-3"
                  >
                    <AnimatedFilters
                      v-if="freeAgentsTabVisible"
                      v-model="teamsPanel"
                      :options="teamsPanelTabs"
                      square
                    />
                    <div v-else :class="tacticalSectionLabelClasses">
                      <span :class="tacticalSectionTickClasses"></span>
                      {{ $t("tournament.page.roster_section") }}
                      <span :class="tacticalSectionCountClasses">
                        {{ filteredTeams.length }}
                      </span>
                    </div>

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
                        <component
                          :is="allTeamsCollapsed ? Maximize : Minimize"
                          class="mr-1.5 h-4 w-4 shrink-0"
                        />
                        {{
                          allTeamsCollapsed
                            ? $t("tournament.teams_filter.expand_all")
                            : $t("tournament.teams_filter.collapse_all")
                        }}
                      </Button>
                    </div>
                  </div>

                  <FadeSwap>
                    <TournamentFreeAgents
                      v-if="teamsPanel === 'free-agents'"
                      key="free-agents"
                      :tournament="tournament"
                    />

                    <div
                      v-else-if="visibleTeams.length === 0"
                      key="no-teams"
                      class="grid justify-items-start gap-3 rounded-lg border border-dashed border-border p-8 text-muted-foreground"
                    >
                      {{ $t("tournament.page.no_teams_yet") }}
                      <Button
                        v-if="tournament.is_organizer"
                        variant="outline"
                        size="sm"
                        @click="openManage('teams')"
                      >
                        <UserPlus class="h-4 w-4" />
                        {{ $t("tournament.manage.invite_teams") }}
                      </Button>
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
              </div>
            </PageTransition>
          </TabsContent>

          <TabsContent v-if="statsTabVisible" value="stats">
            <PageTransition>
              <TournamentStats :tournament="tournament" />
            </PageTransition>
          </TabsContent>

          <TabsContent v-if="tournament?.is_organizer" value="manage">
            <PageTransition>
              <TournamentManage
                v-model:section="manageSection"
                :tournament="tournament"
                :registration="tournamentRegistration"
                :check-in-teams="checkInTeams"
                :check-in-review-visible="checkInReviewVisible"
              />
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
            <!-- A free agent enters alone, so the lineup minimum is not the
               sheet's headline any more -- the team half of the form still
               states it where it applies. -->
            <SheetDescription v-if="!freeAgentsTabVisible">
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
              :registration="tournamentRegistration"
              :my-free-agent="myFreeAgent"
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
    <TournamentDetailSkeleton
      v-else
      key="skeleton"
      :preview="tournamentPreview"
    />
  </FadeSwap>
</template>

<script lang="ts">
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useAuthStore } from "~/stores/AuthStore";
import tournamentTeamFields from "~/graphql/tournamentTeamFields";
import { playerFields, playerFieldsWithoutElo } from "~/graphql/playerFields";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { bracketProposalSelection } from "~/graphql/bracketNegotiation";
import { formatPrizePool } from "~/utilities/prizePool";
import {
  getRequestedRouteTab,
  getRouteTabValue,
  normalizeRouteTab,
  replaceRouteTab,
} from "~/composables/useRouteTab";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { useChatTabs } from "~/composables/useChatTabs";
import { tournamentChatTab } from "~/composables/useChatTabSetup";
import { cancelChatTabRestore } from "~/composables/useChatTabPersistence";
import { setActiveHub } from "~/composables/useHubState";
import { useRightSidebar } from "~/composables/useRightSidebar";

// Tabs from the old layout, mapped to where their content lives now.
const LEGACY_TABS: Record<string, { tab: string; section?: string }> = {
  "my-team": { tab: "teams" },
  "match-settings": { tab: "overview" },
  "free-agents": { tab: "teams" },
  standings: { tab: "overview" },
  results: { tab: "matches" },
  information: { tab: "manage", section: "details" },
  prizes: { tab: "manage", section: "prizes" },
  "match-options": { tab: "manage", section: "match-rules" },
  organizers: { tab: "manage", section: "organizers" },
  awards: { tab: "manage", section: "prizes" },
  notifications: { tab: "manage", section: "discord" },
};

export default {
  data() {
    return {
      myTeam: undefined,
      // The two halves the `tournament` computed merges: the live subscription
      // and the static query. Nothing should read these directly.
      //
      // Typed rather than left to infer `undefined`: a bare `undefined` narrows
      // to `never`, and every `tournament.x` in this file's 1000-line template
      // then type-errors on a value that is plainly an object at runtime.
      tournamentLive: undefined as Record<string, any> | undefined,
      tournamentStatic: undefined as Record<string, any> | undefined,
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
      // The Teams tab's pane: the roster, or the free-agent pool when the
      // tournament takes free agents.
      teamsPanel: "roster",
      manageSection: "details",
      teamFilter: "all",
      collapsedTeams: new Set(),
      myTeamLoaded: false,
      myFreeAgentLoaded: false,
      registrationLoaded: false,
      e_match_types: [],
    };
  },
  // Organizer edit surfaces (information, prizes, organizers, organizer teams,
  // match options, award configs) mutate data that now lives in the static
  // query rather than the live subscription, so it no longer refreshes itself.
  // They inject this and call it once their mutation resolves.
  provide() {
    return {
      refetchTournamentStatic: () => this.refetchTournamentStatic(),
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
    // The half of the tournament that does not change second to second:
    // branding, organizers, prizes, categories, match options and the awards
    // podium. Deliberately a query rather than part of the live subscription --
    // as subscription fields these were re-selected every poll, and the awards
    // branch alone drags a nested tournament_team -> roster -> player join
    // whose player rows each cost an elo and three sanction lookups.
    //
    // Kept fresh by `refetchTournamentStatic`: the status watcher below (so a
    // podium appears the moment a tournament finishes) and the organizer edit
    // surfaces, which inject it and call it after they mutate.
    tournamentStatic: {
      fetchPolicy: "cache-and-network",
      query: typedGql("query")({
        tournaments_by_pk: [
          {
            id: $("tournamentId", "uuid!"),
          },
          {
            id: true,
            description: true,
            logo: true,
            banner: true,
            homepage: true,
            location: true,
            latitude: true,
            longitude: true,
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
                      // Podium only: TournamentResults renders these with
                      // :show-elo="false", so the elo computed field would
                      // be fetched per player and thrown away.
                      player: playerFieldsWithoutElo,
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
          },
        ],
      }),
      variables: function () {
        return {
          tournamentId: this.$route.params.tournamentId,
        };
      },
      result: function ({ data }) {
        this.tournamentStatic = data?.tournaments_by_pk ?? undefined;
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
              // Cast: current_stage is a new computed field; drop it once
              // `yarn codegen` has run against a migrated stack.
              ...({ current_stage: true } as {}),
              auto_start: true,
              scheduling_mode: true,
              league_season_division: {
                id: true,
              },
              awards_enabled: true,
              substitutes_enabled: true,
              e_tournament_status: {
                description: true,
              },
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
                  max_rounds: true,
                  swiss_no_elimination: true,
                  decider_best_of: true,
                  default_best_of: true,
                  final_map_advantage: true,
                  settings: true,
                  third_place_match: true,
                  options: matchOptionsFields,
                  windows: [
                    {},
                    {
                      round: true,
                      opens_at: true,
                      closes_at: true,
                      default_match_at: true,
                    },
                  ],
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
                      finished: true,
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
                        scheduled_at: true,
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
                        team_id: true,
                        team: {
                          name: true,
                        },
                      },
                      team_2: {
                        id: true,
                        name: true,
                        team_id: true,
                        team: {
                          name: true,
                        },
                      },
                      ...bracketProposalSelection,
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
          this.tournamentLive = data.tournaments_by_pk;
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
          this.registrationLoaded = true;
        },
        // A failed subscription must not hold the participant panels back.
        error: function (this: any) {
          this.registrationLoaded = true;
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
          this.myFreeAgentLoaded = true;
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
    /**
     * The tournament as this page and its ~20 child components see it: the
     * static query merged under the live subscription.
     *
     * Gated on the live half rather than on either, so nothing ever renders
     * against a tournament that has branding but no status or permission
     * flags. That is the same moment the page began rendering when this was a
     * single subscription, so the split is invisible to everything downstream.
     */
    tournament(): Record<string, any> | undefined {
      if (!this.tournamentLive) {
        return undefined;
      }
      return { ...this.tournamentStatic, ...this.tournamentLive };
    },
    chatRoomTournament(): { id: string; name: string } | undefined {
      const id = this.tournament?.id;
      if (!id) {
        return undefined;
      }
      return (
        useMatchLobbyStore().chatTournaments as Array<{
          id: string;
          name: string;
        }>
      ).find((candidate) => candidate.id === id);
    },
    chatRoomUnreadLabel(): string {
      if (!this.chatRoomTournament) {
        return "";
      }
      const unread =
        useChatTabs().unreadCounts.value[
          tournamentChatTab(this.chatRoomTournament).id
        ] ?? 0;
      if (unread <= 0) {
        return "";
      }
      return unread > 100 ? "100+" : String(unread);
    },
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
    teamsPanelTabs() {
      return [
        {
          key: "roster",
          label: this.$t("tournament.page.roster_section"),
          count: this.filteredTeams.length,
        },
        {
          key: "free-agents",
          label: this.$t("tournament.free_agents.title"),
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
      if (this.tournament?.stages?.length || this.tournament?.is_organizer) {
        tabs.push("bracket");
      }
      if (this.matchesTabVisible) {
        tabs.push("matches");
      }
      tabs.push("teams");
      if (this.statsTabVisible) {
        tabs.push("stats");
      }
      if (this.tournament?.is_organizer) {
        tabs.push("manage");
      }
      return tabs;
    },
    publicTabs() {
      const labels: Record<string, string> = {
        overview: this.$t("tournament.overview"),
        bracket: this.$t("tournament.page.bracket_tab"),
        matches: this.$t("tournament.page.matches_tab"),
        teams: this.$t("tournament.teams.count", {
          count: this.tournament?.teams_aggregate?.aggregate?.count || 0,
        }),
        stats: this.$t("tournament.stats.title"),
      };
      return this.availableTournamentTabs
        .filter((tab: string) => tab !== "manage")
        .map((tab: string) => ({ value: tab, label: labels[tab] }));
    },
    participantReady() {
      if (!this.registrationLoaded) {
        return false;
      }
      if (!this.me?.steam_id) {
        return true;
      }
      return (
        this.myTeamLoaded &&
        (!this.freeAgentsTabVisible || this.myFreeAgentLoaded)
      );
    },
    matchesTabVisible() {
      const status = this.tournament?.status;
      return (
        status === e_tournament_status_enum.Live ||
        status === e_tournament_status_enum.Paused ||
        status === e_tournament_status_enum.Finished
      );
    },
    startLabel() {
      if (!this.tournament?.start) {
        return "";
      }
      return new Intl.DateTimeFormat(this.$i18n.locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(this.tournament.start));
    },
    hasStatusActions() {
      const t = this.tournament;
      if (!t) {
        return false;
      }
      return (
        t.can_open_registration ||
        t.can_close_registration ||
        t.can_start ||
        t.can_pause ||
        t.can_resume ||
        (t.can_setup && !this.leagueSeasonId) ||
        (!this.leagueSeasonId &&
          (t.can_cancel || t.status !== e_tournament_status_enum.Live))
      );
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
    openChatRoom() {
      if (!this.chatRoomTournament) {
        return;
      }
      cancelChatTabRestore();
      useChatTabs().openTab({
        ...tournamentChatTab(this.chatRoomTournament),
        activate: true,
      });
      setActiveHub("chat");
      useRightSidebar().setRightSidebarOpen(true);
    },
    refetchTournamentStatic() {
      return this.$apollo?.queries?.tournamentStatic?.refetch();
    },
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
      // Old links to the eleven-tab layout land where that content lives now.
      const legacy = LEGACY_TABS[requestedTab ?? ""];
      if (legacy) {
        if (legacy.section && !this.tournament.is_organizer) {
          void replaceRouteTab(
            this.$router,
            this.$route,
            "overview",
            "overview",
          );
          return;
        }
        if (legacy.section) {
          this.manageSection = legacy.section;
        }
        void this.$router.replace({
          query: {
            ...this.$route.query,
            tab: legacy.tab,
            section: legacy.section ?? undefined,
          },
        });
        return;
      }
      const section = this.$route.query.section;
      if (typeof section === "string" && section) {
        this.manageSection = section;
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
    toggleManage() {
      this.activeTab = this.activeTab === "manage" ? "overview" : "manage";
    },
    openManage(section: string) {
      this.manageSection = section;
      this.activeTab = "manage";
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
    // Awards are granted server-side when a tournament finishes, and they now
    // arrive on the static query. Without this the podium would not appear
    // until the page was reloaded.
    "tournamentLive.status"(status, previousStatus) {
      if (previousStatus !== undefined && status !== previousStatus) {
        void this.refetchTournamentStatic();
      }
    },
    activeTab(newTab) {
      if (!this.tournament || !this.availableTournamentTabs.includes(newTab)) {
        return;
      }

      const query = { ...this.$route.query };
      if (newTab === "manage") {
        query.section = this.manageSection;
      } else {
        delete query.section;
      }
      void replaceRouteTab(
        this.$router,
        { path: this.$route.path, hash: this.$route.hash, query },
        newTab,
        "overview",
      );
    },
    manageSection(section) {
      if (
        this.activeTab !== "manage" ||
        this.$route.query.section === section
      ) {
        return;
      }
      void this.$router.replace({
        query: { ...this.$route.query, section },
      });
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
