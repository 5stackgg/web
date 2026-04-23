<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #title>{{ $t("pages.tournaments.title") }}</template>

      <template #actions="{ tabs }">
        <div class="flex items-center gap-2">
          <NuxtLink
            v-if="canCreateTournament"
            to="/tournaments/create"
            :class="tacticalCtaButtonClasses"
            :title="$t('pages.tournaments.create')"
          >
            <PlusCircle class="w-4 h-4" />
            <span class="hidden lg:inline">{{
              $t("pages.tournaments.create")
            }}</span>
          </NuxtLink>

          <Tabs v-model="activeTab">
            <TabsList variant="underline" :class="tabs.listClass">
              <TabsTrigger value="live" :class="tabs.triggerClass">
                <span
                  :class="[tabs.indicatorClass, tabs.indicatorLiveClass]"
                ></span>
                {{ $t("common.live") }}
              </TabsTrigger>
              <TabsTrigger value="upcoming" :class="tabs.triggerClass">
                <span
                  :class="[tabs.indicatorClass, tabs.indicatorUpcomingClass]"
                ></span>
                {{ $t("pages.tournaments.tabs.upcoming") }}
              </TabsTrigger>
              <TabsTrigger value="finished" :class="tabs.triggerClass">
                <span
                  :class="[tabs.indicatorClass, tabs.indicatorFinishedClass]"
                ></span>
                {{ $t("common.finished") }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <Tabs v-model="activeTab">
      <TabsContent value="live">
        <div class="space-y-6">
          <section class="space-y-4">
            <div
              class="relative overflow-hidden rounded-md border border-destructive/25 bg-[linear-gradient(90deg,hsl(var(--destructive)/0.14)_0%,hsl(var(--card)/0.42)_56%,transparent_100%)] px-4 py-3"
            >
              <span
                aria-hidden="true"
                class="absolute inset-y-0 left-0 w-1 bg-destructive shadow-[0_0_18px_hsl(var(--destructive)/0.65)]"
              ></span>

              <div class="relative flex items-center justify-between gap-4">
                <div class="flex min-w-0 items-center gap-3">
                  <span
                    class="relative grid h-9 w-9 shrink-0 place-items-center rounded-md border border-destructive/35 bg-destructive/10 text-destructive"
                  >
                    <RadioTower class="h-4 w-4" />
                    <span
                      aria-hidden="true"
                      class="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse"
                    ></span>
                  </span>
                  <h2
                    class="truncate font-sans text-sm font-bold uppercase tracking-[0.18em] text-foreground"
                  >
                    {{ $t("common.live") }}
                  </h2>
                </div>

                <Skeleton v-if="loadingLive" class="h-7 w-10" />
                <span
                  v-else
                  class="inline-flex h-7 min-w-9 items-center justify-center rounded-md border border-destructive/35 bg-destructive/10 px-2 font-mono text-xs font-bold tabular-nums text-destructive"
                >
                  {{ liveTournaments?.length || 0 }}
                </span>
              </div>
            </div>

            <Transition v-bind="fadeTransition" mode="out-in">
              <Empty v-if="loadingLive" key="loading" class="min-h-[200px]">
                <div class="space-y-3 w-full max-w-md">
                  <Skeleton class="h-4 w-3/4 mx-auto" />
                  <Skeleton class="h-3 w-full" />
                  <Skeleton class="h-3 w-5/6 mx-auto" />
                </div>
              </Empty>

              <div
                v-else-if="liveTournaments && liveTournaments.length > 0"
                key="tournaments"
                class="space-y-4"
              >
                <TournamentTableRow
                  v-for="tournament in liveTournaments"
                  :key="tournament.id"
                  :tournament="tournament"
                ></TournamentTableRow>
              </div>

              <Empty v-else key="empty" class="min-h-[200px]">
                <EmptyTitle>{{
                  $t("pages.tournaments.tabs.no_live_title")
                }}</EmptyTitle>
                <EmptyDescription>{{
                  $t("tournament.table.no_tournaments_found")
                }}</EmptyDescription>
              </Empty>
            </Transition>
          </section>

          <template
            v-if="
              registrationOpenTournaments &&
              registrationOpenTournaments.length > 0
            "
          >
            <Separator v-if="showSeparators" />

            <section class="space-y-4">
              <div
                class="relative overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.32)] bg-[linear-gradient(90deg,hsl(var(--tac-amber)/0.12)_0%,hsl(var(--card)/0.34)_58%,transparent_100%)] px-4 py-3"
              >
                <span
                  aria-hidden="true"
                  class="absolute inset-y-0 left-0 w-1 bg-[hsl(var(--tac-amber))] shadow-[0_0_18px_hsl(var(--tac-amber)/0.55)]"
                ></span>

                <div class="relative flex items-center justify-between gap-4">
                  <div class="flex min-w-0 items-center gap-3">
                    <span
                      class="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]"
                    >
                      <TicketCheck class="h-4 w-4" />
                    </span>
                    <h2
                      class="truncate font-sans text-sm font-bold uppercase tracking-[0.18em] text-foreground"
                    >
                      {{ $t("pages.tournaments.open_for_registration") }}
                    </h2>
                  </div>

                  <span
                    class="inline-flex h-7 min-w-9 items-center justify-center rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] px-2 font-mono text-xs font-bold tabular-nums text-[hsl(var(--tac-amber))]"
                  >
                    {{ registrationOpenTournaments.length }}
                  </span>
                </div>
              </div>

              <div class="space-y-4">
                <TournamentTableRow
                  v-for="tournament in registrationOpenTournaments"
                  :key="tournament.id"
                  :tournament="tournament"
                ></TournamentTableRow>
              </div>
            </section>
          </template>
        </div>
      </TabsContent>

      <TabsContent value="upcoming">
        <Transition v-bind="fadeTransition" mode="out-in">
          <Empty v-if="loadingUpcoming" key="loading" class="min-h-[200px]">
            <div class="space-y-3 w-full max-w-md">
              <Skeleton class="h-4 w-3/4 mx-auto" />
              <Skeleton class="h-3 w-full" />
              <Skeleton class="h-3 w-5/6 mx-auto" />
            </div>
          </Empty>

          <div
            v-else-if="upcomingTournaments && upcomingTournaments.length > 0"
            key="tournaments"
            class="space-y-4"
          >
            <TournamentTableRow
              v-for="tournament in upcomingTournaments"
              :key="tournament.id"
              :tournament="tournament"
            ></TournamentTableRow>
          </div>

          <Empty v-else key="empty" class="min-h-[200px]">
            <EmptyTitle>{{
              $t("pages.tournaments.tabs.no_upcoming_title")
            }}</EmptyTitle>
            <EmptyDescription>{{
              $t("tournament.table.no_tournaments_found")
            }}</EmptyDescription>
          </Empty>
        </Transition>

        <Teleport defer to="#pagination">
          <Transition v-bind="paginationFadeTransition">
            <pagination
              v-if="
                !loadingUpcoming &&
                upcomingTournaments_aggregate &&
                upcomingTournaments_aggregate.aggregate.count > 0
              "
              :page="upcomingPage"
              :items-per-page="perPage"
              @page="
                (_page: number) => {
                  upcomingPage = _page;
                }
              "
              :total="upcomingTournaments_aggregate?.aggregate?.count"
            ></pagination>
          </Transition>
        </Teleport>
      </TabsContent>

      <TabsContent value="finished">
        <Transition v-bind="fadeTransition" mode="out-in">
          <Empty v-if="loadingFinished" key="loading" class="min-h-[200px]">
            <div class="space-y-3 w-full max-w-md">
              <Skeleton class="h-4 w-3/4 mx-auto" />
              <Skeleton class="h-3 w-full" />
              <Skeleton class="h-3 w-5/6 mx-auto" />
            </div>
          </Empty>

          <div
            v-else-if="finishedTournaments && finishedTournaments.length > 0"
            key="tournaments"
            class="space-y-4"
          >
            <TournamentTableRow
              v-for="tournament in finishedTournaments"
              :key="tournament.id"
              :tournament="tournament"
            ></TournamentTableRow>
          </div>

          <Empty v-else key="empty" class="min-h-[200px]">
            <EmptyTitle>{{
              $t("pages.tournaments.tabs.no_finished_title")
            }}</EmptyTitle>
            <EmptyDescription>{{
              $t("pages.tournaments.no_finished")
            }}</EmptyDescription>
          </Empty>
        </Transition>

        <Teleport defer to="#pagination">
          <Transition v-bind="paginationFadeTransition">
            <pagination
              v-if="
                !loadingFinished &&
                finishedTournaments_aggregate &&
                finishedTournaments_aggregate.aggregate.count > 0
              "
              :page="finishedPage"
              :items-per-page="perPage"
              @page="
                (_page: number) => {
                  finishedPage = _page;
                }
              "
              :total="finishedTournaments_aggregate?.aggregate?.count"
            ></pagination>
          </Transition>
        </Teleport>
      </TabsContent>
    </Tabs>
  </PageTransition>

  <div id="pagination"></div>
</template>

<script lang="ts">
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Separator } from "~/components/ui/separator";
import { PlusCircle, RadioTower, TicketCheck } from "lucide-vue-next";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";

const fadeTransition = {
  enterActiveClass: "transition-opacity duration-200 ease-out",
  leaveActiveClass: "transition-opacity duration-200 ease-out",
  enterFromClass: "opacity-0",
  leaveToClass: "opacity-0",
};

const paginationFadeTransition = {
  enterActiveClass: "delay-1000 transition-opacity duration-300 ease-out",
  leaveActiveClass: "transition-opacity duration-200 ease-out",
  enterFromClass: "opacity-0",
  leaveToClass: "opacity-0",
};

export default {
  components: {
    TournamentTableRow,
    TacticalPageHeader,
    PlusCircle,
    RadioTower,
    TicketCheck,
  },
  setup() {
    const { isMobile } = useSidebar();
    return { isMobile, tacticalCtaButtonClasses };
  },
  data() {
    return {
      activeTab: "live",
      perPage: 10,
      registrationOpenTournaments: [],
      liveTournaments: [],
      upcomingPage: 1,
      finishedPage: 1,
      upcomingTournaments: [],
      upcomingTournaments_aggregate: undefined,
      finishedTournaments: [],
      finishedTournaments_aggregate: undefined,
      loadingLive: true,
      loadingUpcoming: true,
      loadingFinished: true,
      fadeTransition,
      paginationFadeTransition,
    };
  },
  apollo: {
    $subscribe: {
      registrationOpenTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              where: {
                status: {
                  _eq: $("status", "e_tournament_status_enum"),
                },
              },
              order_by: [
                {},
                {
                  start: order_by.asc,
                },
              ],
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            status: e_tournament_status_enum.RegistrationOpen,
          };
        },
        result: function ({ data }: { data: any }) {
          this.registrationOpenTournaments = data.tournaments || [];
        },
      },
      liveTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              where: {
                status: {
                  _eq: $("status", "e_tournament_status_enum"),
                },
              },
              order_by: [
                {},
                {
                  start: order_by.asc,
                },
              ],
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            status: e_tournament_status_enum.Live,
          };
        },
        result: function ({ data }: { data: any }) {
          this.liveTournaments = data.tournaments || [];
          this.loadingLive = false;
        },
      },
      upcomingTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              order_by: [
                {},
                {
                  start: order_by.asc,
                },
              ],
              where: {
                status: {
                  _in: $("statuses", "[e_tournament_status_enum]"),
                },
              },
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            limit: this.perPage,
            offset: (this.upcomingPage - 1) * this.perPage,
            statuses: [
              e_tournament_status_enum.RegistrationOpen,
              e_tournament_status_enum.RegistrationClosed,
              e_tournament_status_enum.Setup,
            ],
          };
        },
        result: function ({ data }: { data: any }) {
          this.upcomingTournaments = data.tournaments || [];
          this.loadingUpcoming = false;
        },
      },
      upcomingTournaments_aggregate: {
        query: typedGql("subscription")({
          tournaments_aggregate: [
            {
              where: {
                status: {
                  _in: $("statuses", "[e_tournament_status_enum]"),
                },
              },
            },
            {
              aggregate: {
                count: true,
              },
            },
          ],
        }),
        variables: function () {
          return {
            statuses: [
              e_tournament_status_enum.RegistrationOpen,
              e_tournament_status_enum.RegistrationClosed,
              e_tournament_status_enum.Setup,
            ],
          };
        },
        result: function ({ data }: { data: any }) {
          this.upcomingTournaments_aggregate = data.tournaments_aggregate;
        },
      },
      finishedTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              order_by: [
                {},
                {
                  start: order_by.desc,
                },
              ],
              where: {
                status: {
                  _in: $("statuses", "[e_tournament_status_enum]"),
                },
              },
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            limit: this.perPage,
            offset: (this.finishedPage - 1) * this.perPage,
            statuses: [
              e_tournament_status_enum.Finished,
              e_tournament_status_enum.Cancelled,
              e_tournament_status_enum.CancelledMinTeams,
            ],
          };
        },
        result: function ({ data }: { data: any }) {
          this.finishedTournaments = data.tournaments || [];
          this.loadingFinished = false;
        },
      },
      finishedTournaments_aggregate: {
        query: typedGql("subscription")({
          tournaments_aggregate: [
            {
              where: {
                status: {
                  _in: $("statuses", "[e_tournament_status_enum]"),
                },
              },
            },
            {
              aggregate: {
                count: true,
              },
            },
          ],
        }),
        variables: function () {
          return {
            statuses: [
              e_tournament_status_enum.Finished,
              e_tournament_status_enum.Cancelled,
              e_tournament_status_enum.CancelledMinTeams,
            ],
          };
        },
        result: function ({ data }: { data: any }) {
          this.finishedTournaments_aggregate = data.tournaments_aggregate;
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
    canCreateTournament() {
      const me = useAuthStore().me;
      if (!me) {
        return false;
      }

      return useAuthStore().isRoleAbove(
        useApplicationSettingsStore().tournamentCreateRole,
      );
    },
  },
};
</script>
