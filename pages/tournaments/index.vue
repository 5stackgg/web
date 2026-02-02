<template>
  <div class="flex-grow flex flex-col gap-6">
    <PageTransition>
      <PageHeading>
        <template #title>{{ $t("pages.tournaments.title") }}</template>

        <template #actions>
          <div class="flex gap-4 items-center">
            <NuxtLink v-if="canCreateTournament" to="/tournaments/create">
              <Button :size="isMobile ? 'default' : 'lg'">
                <PlusCircle class="w-4 h-4" />
                <span class="hidden md:inline ml-2">{{
                  $t("pages.tournaments.create")
                }}</span>
              </Button>
            </NuxtLink>
          </div>
        </template>
      </PageHeading>
    </PageTransition>

    <!-- Open for Registration Section -->
    <PageTransition :delay="100">
      <div
        v-if="
          registrationOpenTournaments && registrationOpenTournaments.length > 0
        "
      >
        <div class="flex items-center gap-2 mb-4">
          <h2 class="text-xl font-semibold">
            {{ $t("pages.tournaments.open_for_registration") }}
          </h2>
        </div>
        <TournamentTableRow
          v-for="tournament in registrationOpenTournaments"
          :key="tournament.id"
          :tournament="tournament"
          class="min-w-[500px]"
        ></TournamentTableRow>
        <Separator class="my-4" />
      </div>
    </PageTransition>

    <!-- Tabs Section -->
    <PageTransition :delay="200">
      <AnimatedCard variant="gradient" class="p-4">
        <Tabs default-value="live">
          <TabsList>
            <TabsTrigger value="live">{{
              $t("pages.tournaments.tabs.live")
            }}</TabsTrigger>
            <TabsTrigger value="upcoming">{{
              $t("pages.tournaments.tabs.upcoming")
            }}</TabsTrigger>
            <TabsTrigger value="finished">{{
              $t("pages.tournaments.tabs.finished")
            }}</TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <Empty
              v-if="!liveTournaments || liveTournaments.length === 0"
            >
              <p class="text-muted-foreground">
                {{ $t("tournament.table.no_tournaments_found") }}
              </p>
            </Empty>
            <div v-else class="space-y-4">
              <TournamentTableRow
                v-for="tournament in liveTournaments"
                :key="tournament.id"
                :tournament="tournament"
              ></TournamentTableRow>
            </div>
          </TabsContent>

          <TabsContent value="upcoming">
            <Empty
              v-if="!upcomingTournaments || upcomingTournaments.length === 0"
            >
              <p class="text-muted-foreground">
                {{ $t("tournament.table.no_tournaments_found") }}
              </p>
            </Empty>
            <div v-else class="space-y-4">
              <TournamentTableRow
                v-for="tournament in upcomingTournaments"
                :key="tournament.id"
                :tournament="tournament"
              ></TournamentTableRow>
            </div>

            <Teleport defer to="#pagination">
              <pagination
                :page="upcomingPage"
                :items-per-page="perPage"
                @page="
                  (_page: number) => {
                    upcomingPage = _page;
                  }
                "
                :total="upcomingTournaments_aggregate?.aggregate?.count"
              ></pagination>
            </Teleport>
          </TabsContent>

          <TabsContent value="finished">
            <Empty
              v-if="!finishedTournaments || finishedTournaments.length === 0"
            >
              <p class="text-muted-foreground">
                {{ $t("pages.tournaments.no_finished") }}
              </p>
            </Empty>
            <div v-else class="space-y-4">
              <TournamentTableRow
                v-for="tournament in finishedTournaments"
                :key="tournament.id"
                :tournament="tournament"
              ></TournamentTableRow>
            </div>

            <Teleport defer to="#pagination">
              <pagination
                :page="finishedPage"
                :items-per-page="perPage"
                @page="
                  (_page: number) => {
                    finishedPage = _page;
                  }
                "
                :total="finishedTournaments_aggregate?.aggregate?.count"
              ></pagination>
            </Teleport>
          </TabsContent>
        </Tabs>
      </AnimatedCard>
    </PageTransition>

    <div id="pagination"></div>
  </div>
</template>

<script lang="ts">
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Separator } from "~/components/ui/separator";
import { PlusCircle } from "lucide-vue-next";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import Empty from "~/components/ui/empty/Empty.vue";

export default {
  components: {
    TournamentTableRow,
    PageHeading,
    Button,
    PlusCircle,
  },
  setup() {
    const { isMobile } = useSidebar();
    return { isMobile };
  },
  data() {
    return {
      perPage: 10,
      registrationOpenTournaments: [],
      liveTournaments: [],
      upcomingPage: 1,
      finishedPage: 1,
      upcomingTournaments: [],
      upcomingTournaments_aggregate: undefined,
      finishedTournaments: [],
      finishedTournaments_aggregate: undefined,
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
              e_tournament_status_enum.RegistrationClosed,
              e_tournament_status_enum.Setup,
            ],
          };
        },
        result: function ({ data }: { data: any }) {
          this.upcomingTournaments = data.tournaments || [];
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
