<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref } from "vue";
import {
  MoreVertical,
  Trash2,
  LogOut,
  Pencil,
  Medal,
  Swords,
} from "lucide-vue-next";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HeightGlide from "~/components/ui/transitions/HeightGlide.vue";
import MobileTabSelect from "~/components/common/MobileTabSelect.vue";
import AwardComposer from "~/components/award/AwardComposer.vue";
import TeamForm from "~/components/teams/TeamForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
import TeamCareerStats from "~/components/team/TeamCareerStats.vue";
import TeamVetoStats from "~/components/team/TeamVetoStats.vue";
import TeamVetoSimulator from "~/components/team/TeamVetoSimulator.vue";
import TeamUtilityUtility from "~/components/team/TeamUtilityUtility.vue";
import TeamRankSummary from "~/components/team/TeamRankSummary.vue";
import TeamHighlights from "~/components/team/TeamHighlights.vue";
import TeamScrimManager from "~/components/team/TeamScrimManager.vue";
import TeamMatches from "~/components/team/TeamMatches.vue";
import ScrimRequestDialog from "~/components/team/ScrimRequestDialog.vue";
import TeamHero from "~/components/team/TeamHero.vue";
import TeamStage from "~/components/team/TeamStage.vue";
import TeamResultsTicker from "~/components/team/TeamResultsTicker.vue";
import TeamOverview from "~/components/team/TeamOverview.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import { useTeamNeeds } from "~/composables/useTeamNeeds";

definePageMeta({ persistQueryKeys: ["invite"] });

const teamMenu = ref(false);

// Scrim requests waiting on the team, for the Scrim Finder tab's badge. The
// team lives in the Options half below, so it's read off the instance -- only
// once mounted: a read during setup, before data() exists, caches `team` as
// not-an-instance-key and production builds then resolve `this.team` to
// undefined.
const instance = getCurrentInstance();
const mounted = ref(false);
onMounted(() => (mounted.value = true));
const { items: teamNeeds } = useTeamNeeds(
  () => {
    if (!mounted.value) return null;
    const team = (instance?.proxy as any)?.team;
    return team?.can_manage_scrims ? team : null;
  },
  { followInvites: false },
);
const scrimNeedsCount = computed(
  () =>
    teamNeeds.value.filter(
      (item) => item.kind === "scrim" || item.kind === "counter",
    ).length,
);
</script>

<template>
  <PageTransition v-if="team">
    <div
      class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-stretch"
    >
      <TeamHero
        :team="team"
        :awards="teamAwards"
        :matches-count="teamMatches.length"
      >
        <template #actions>
          <Button
            v-if="showRequestScrim"
            size="sm"
            class="tac-amber-cta h-8 gap-1.5 border font-semibold"
            :disabled="!me"
            @click="scrimRequestOpen = true"
          >
            <Swords class="size-3.5" />
            {{ $t("scrim.request_scrim") }}
          </Button>
        </template>
        <template #menu>
          <DropdownMenu v-model:open="teamMenu" v-if="isOnTeam || isAdmin">
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="icon-sm"
                :aria-label="$t('team.pulse.hero.team_actions')"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-[200px]">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  v-if="canGrantAwards"
                  @click="awardComposerOpen = true"
                >
                  <Medal />
                  {{ $t("awards.composer.grant_here") }}
                </DropdownMenuItem>
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
                <template v-if="isOnTeam && !isTeamOwner">
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
        </template>
      </TeamHero>

      <TeamStage
        :team="team"
        :is-on-team="isOnTeam"
        :matches-count="teamMatches.length"
        :can-request-scrim="showRequestScrim"
        @open-scrims="tab = 'scrim'"
        @request-scrim="scrimRequestOpen = true"
      />
    </div>
  </PageTransition>

  <PageTransition v-if="team" :delay="50">
    <TeamResultsTicker
      class="mt-8"
      :team-id="team.id"
      @all-matches="tab = 'matches'"
    />
  </PageTransition>

  <!-- Panels stay mounted after their first visit, so switching back is
       instant instead of refetching and re-skeletoning. -->
  <Tabs v-if="team" v-model="tab" :unmount-on-hide="false" class="mt-8 w-full">
    <MobileTabSelect v-model="tab" :items="tabItems(scrimNeedsCount)" />
    <div class="overflow-x-auto max-md:hidden">
      <TabsList variant="underline" class="h-auto flex-nowrap justify-start">
        <TabsTrigger value="overview">{{
          $t("team.tabs.overview")
        }}</TabsTrigger>
        <TabsTrigger value="matches">{{
          $t("team.pulse.tabs.matches")
        }}</TabsTrigger>
        <TabsTrigger value="stats">{{ $t("team.tabs.stats") }}</TabsTrigger>
        <TabsTrigger value="veto">{{ $t("common.map_veto") }}</TabsTrigger>
        <TabsTrigger v-if="canSeeUtility" value="utility">{{
          $t("match.tabs.utility")
        }}</TabsTrigger>
        <TabsTrigger value="highlights">{{
          $t("team.tabs.highlights")
        }}</TabsTrigger>
        <TabsTrigger v-if="showScrimTab" value="scrim">
          {{ $t("team.tabs.scrim") }}
          <span
            v-if="scrimNeedsCount"
            class="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--tac-amber))] px-1 text-[0.65rem] font-bold tabular-nums text-[hsl(var(--tac-amber-foreground))]"
            ><span aria-hidden="true">{{ scrimNeedsCount }}</span
            ><span class="sr-only">{{
              $t("team.pulse.tabs.scrim_waiting", { count: scrimNeedsCount })
            }}</span></span
          >
        </TabsTrigger>
      </TabsList>
    </div>
    <HeightGlide class="mt-6">
      <TabsContent value="overview" class="tab-panel-in mt-0">
        <TeamOverview
          v-if="visitedTabs.includes('overview')"
          ref="overview"
          :team="team"
          :team-awards="teamAwards"
        />
      </TabsContent>

      <TabsContent value="matches" class="tab-panel-in mt-0">
        <TeamMatches
          v-if="visitedTabs.includes('matches')"
          :team-id="String($route.params.id)"
        />
      </TabsContent>

      <TabsContent value="stats" class="tab-panel-in mt-0">
        <TeamCareerStats
          v-if="visitedTabs.includes('stats')"
          :team-id="String($route.params.id)"
        />
      </TabsContent>

      <TabsContent value="veto" class="tab-panel-in mt-0">
        <div v-if="visitedTabs.includes('veto')" class="space-y-6">
          <TeamVetoStats :team-id="String($route.params.id)" />
          <TeamVetoSimulator :team-id="String($route.params.id)" />
        </div>
      </TabsContent>

      <TabsContent
        v-if="canSeeUtility"
        value="utility"
        class="tab-panel-in mt-0"
      >
        <TeamUtilityUtility
          v-if="visitedTabs.includes('utility')"
          :team-id="String($route.params.id)"
        />
      </TabsContent>

      <TabsContent value="highlights" class="tab-panel-in mt-0">
        <div v-if="visitedTabs.includes('highlights')">
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
      </TabsContent>

      <TabsContent v-if="showScrimTab" value="scrim" class="tab-panel-in mt-0">
        <div v-if="visitedTabs.includes('scrim')">
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
              <!-- The header already carries the amber Request scrim. -->
              <Button
                v-if="!isOnTeam"
                variant="outline"
                size="sm"
                class="h-8 gap-1.5"
                :disabled="!me"
                @click="scrimRequestOpen = true"
              >
                <Swords class="size-3.5" />
                {{ $t("scrim.request_scrim") }}
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </HeightGlide>
  </Tabs>

  <ScrimRequestDialog
    v-if="team && teamOpenToScrims"
    v-model:open="scrimRequestOpen"
    :posting="teamPosting"
  />
  <AwardComposer
    v-if="team && awardComposerOpen"
    v-model:open="awardComposerOpen"
    :team="{ id: team.id, name: team.name }"
    lock-recipient
  />

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
import { awardFields } from "~/graphql/awardFields";

const VALID_TABS = [
  "overview",
  "matches",
  "stats",
  "veto",
  "utility",
  "highlights",
  "scrim",
];

export default {
  data() {
    return {
      team: undefined,
      tab: VALID_TABS.includes(useRoute().query.tab as string)
        ? (useRoute().query.tab as string)
        : "overview",
      teamAwards: [] as any[],
      tournamentMatches: [] as any[],
      editTeamSheet: false,
      awardComposerOpen: false,
      leaveTeamAlertDialog: false,
      deleteTeamAlertDialog: false,
      scrimRequestOpen: false,
      // Tabs mount on their first visit, then stay mounted.
      visitedTabs: [] as string[],
    };
  },
  watch: {
    // The inbox's "Invite player" lands here with ?invite=1, usually before
    // the team has loaded.
    team: "consumeInvite",
    "$route.query.invite": { immediate: true, handler: "consumeInvite" },
    tab: {
      immediate: true,
      handler(value: string) {
        if (!this.visitedTabs.includes(value)) this.visitedTabs.push(value);
        // Reflect the active tab in the URL bar via history (no router
        // navigation, so nothing re-renders/reloads) — still deep-linkable on
        // fresh load.
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
              can_invite: true,
              can_change_role: true,
              ranks: {
                avg_elo: true,
                avg_wingman_elo: true,
                avg_duel_elo: true,
                avg_rush_elo: true,
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
                  status: true,
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
      teamAwards: {
        query: typedGql("subscription")({
          award_recipients: [
            {
              where: {
                player_steam_id: {
                  _is_null: true,
                },
                team_id: {
                  _eq: $("teamId", "uuid!"),
                },
              },
            },
            awardFields,
          ],
        }),
        variables: function () {
          return {
            teamId: this.$route.params.id,
          };
        },
        result: function ({ data }) {
          this.teamAwards = data.award_recipients || [];
        },
      },
    },
  },
  unmounted() {
    useTeamContext().value = null;
  },
  computed: {
    canGrantAwards() {
      return useApplicationSettingsStore().canGrantAwards;
    },
    me() {
      return useAuthStore().me;
    },
    scrimFinderEnabled() {
      return useApplicationSettingsStore().scrimFinderEnabled;
    },
    teamOpenToScrims(): boolean {
      return this.team?.scrim_settings?.enabled === true;
    },
    showRequestScrim(): boolean {
      return (
        !!this.me &&
        this.scrimFinderEnabled &&
        this.teamOpenToScrims &&
        !this.isOnTeam &&
        !this.team?.can_manage_scrims
      );
    },
    // Utility lineups are for the team's own eyes.
    canSeeUtility(): boolean {
      return this.isOnTeam || this.isTeamOwner || this.isAdmin;
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
    isOnTeam() {
      return !!this.team?.roster.some(({ player }) => {
        return player.steam_id === this.me?.steam_id;
      });
    },
    // The owner has to hand the team over before they can walk away from it,
    // otherwise nobody left on the roster can manage it. The database enforces
    // the same rule.
    isTeamOwner() {
      return (
        !!this.me?.steam_id &&
        String(this.team?.owner_steam_id) === String(this.me.steam_id)
      );
    },
    isAdmin() {
      return useAuthStore().isAdmin;
    },
  },
  methods: {
    tabItems(scrimCount: number): Array<{ value: string; label: string }> {
      return [
        { value: "overview", label: this.$t("team.tabs.overview") },
        { value: "matches", label: this.$t("team.pulse.tabs.matches") },
        { value: "stats", label: this.$t("team.tabs.stats") },
        { value: "veto", label: this.$t("common.map_veto") },
        ...(this.canSeeUtility
          ? [{ value: "utility", label: this.$t("match.tabs.utility") }]
          : []),
        { value: "highlights", label: this.$t("team.tabs.highlights") },
        ...(this.showScrimTab
          ? [
              {
                value: "scrim",
                label: scrimCount
                  ? `${this.$t("team.tabs.scrim")} (${scrimCount})`
                  : this.$t("team.tabs.scrim"),
              },
            ]
          : []),
      ];
    },
    // The overview's roster carries the invite. Switching tabs runs an
    // out-in transition, so the roster opens once the overview has entered.
    // The inbox's "Invite player": land on Overview with the roster open. The
    // panel mounts on its first visit, so wait a tick for its ref.
    consumeInvite() {
      if (!this.team || !this.$route.query.invite) return;
      this.showRoster();
      const { invite, ...query } = this.$route.query;
      this.$router.replace({ query });
    },
    showRoster() {
      this.tab = "overview";
      this.$nextTick(() => {
        const overview = this.$refs.overview as
          { showFullRoster: () => void } | undefined;
        overview?.showFullRoster();
      });
    },
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
