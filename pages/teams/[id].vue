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
import { MoreHorizontal, Trash, LogOut, Pencil } from "lucide-vue-next";

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
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

const teamMenu = ref(false);
const teamHeroClasses =
  "relative rounded-lg border border-border px-5 py-4 sm:px-6 sm:py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.55)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']";
const teamHeroEyebrowClasses =
  "mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground";
const teamHeroChevronClasses =
  "translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]";
const teamHeroBodyClasses = "flex flex-wrap items-center gap-7 max-md:gap-4";
const teamHeroEmblemFrameClasses =
  "relative flex h-[140px] w-[140px] items-center justify-center border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] p-1 max-md:h-24 max-md:w-24";
const teamHeroEmblemClasses =
  "font-sans text-[4.5rem] font-bold uppercase tracking-[0.02em] text-transparent [font-stretch:80%] [background:linear-gradient(180deg,hsl(var(--tac-amber))_0%,hsl(var(--tac-amber)_/_0.6)_100%)] [-webkit-background-clip:text] [background-clip:text] [-webkit-text-fill-color:transparent] [text-shadow:0_0_20px_hsl(var(--tac-amber)_/_0.2)] max-md:text-[3rem]";
const teamHeroEmblemCornerClasses = "absolute h-3 w-3 border-[hsl(var(--tac-amber))]";
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
      <div :class="teamHeroEyebrowClasses">
        <span :class="teamHeroChevronClasses">◢</span>
        Team Profile
      </div>

      <div :class="teamHeroBodyClasses">
        <!-- Identity: name, short, captain -->
        <div :class="teamHeroIdentityClasses">
          <div :class="teamHeroNameRowClasses">
            <h1 :class="teamHeroNameClasses">{{ team.name }}</h1>
            <span v-if="team.short_name" :class="teamHeroTagClasses">
              {{ team.short_name }}
            </span>
          </div>

          <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div :class="teamHeroMetaClasses">
              <span :class="teamHeroMetaLabelClasses">
                {{ $t("team.roles.captain") }}
              </span>
              <PlayerDisplay :player="team.owner" :linkable="true" size="sm" />
            </div>

            <span class="hidden sm:inline-block h-5 w-px bg-border"></span>

            <div class="inline-flex items-center gap-5">
              <div :class="teamHeroStatClasses">
                <span :class="teamHeroStatValueClasses">{{
                  team.roster?.length || 0
                }}</span>
                <span :class="teamHeroStatLabelClasses">{{ $t("team.hero.roster") }}</span>
              </div>
              <span :class="teamHeroStatDividerClasses"></span>
              <div :class="teamHeroStatClasses">
                <span :class="teamHeroStatValueClasses">{{
                  team.matches?.length || 0
                }}</span>
                <span :class="teamHeroStatLabelClasses">{{ $t("team.hero.matches") }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div :class="teamHeroActionsClasses">
          <DropdownMenu v-model:open="teamMenu" v-if="isOnTeam || isAdmin">
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="icon">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-[200px]">
              <DropdownMenuGroup>
                <template
                  v-if="isAdmin || team.owner.steam_id === me?.steam_id"
                >
                  <DropdownMenuItem @click="editTeamSheet = true">
                    <Pencil class="mr-2 h-4 w-4" />
                    {{ $t("common.actions.edit") }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    class="text-red-600 focus:text-red-600"
                    @click="deleteTeamAlertDialog = true"
                  >
                    <Trash class="mr-2 h-4 w-4" />
                    {{ $t("common.actions.delete") }}
                  </DropdownMenuItem>
                </template>
                <template v-if="isOnTeam">
                  <DropdownMenuItem
                    class="text-red-600 focus:text-red-600"
                    @click="leaveTeamAlertDialog = true"
                  >
                    <LogOut class="mr-2 h-4 w-4" />
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

  <div v-if="team" class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
    <PageTransition :delay="100" class="lg:col-span-2">
      <TeamMembers :team-id="$route.params.id" />
    </PageTransition>
    <PageTransition :delay="200" class="lg:col-span-3">
      <div class="space-y-3">
        <h2 class="text-lg font-semibold tracking-tight">
          {{ $t("match.recent.title") }}
        </h2>
        <MatchesTable :matches="team.matches" />
      </div>
    </PageTransition>
  </div>

  <Sheet
    v-if="team"
    :open="editTeamSheet"
    @update:open="(open) => (editTeamSheet = open)"
  >
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("team.management.edit") }}</SheetTitle>
        <SheetDescription>
          <TeamForm :team="team" @updated="editTeamSheet = false" />
        </SheetDescription>
      </SheetHeader>
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
          class="bg-red-600 hover:bg-red-700 focus:ring-red-600"
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
          class="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          @click="leaveTeam"
          >{{ $t("common.confirm") }}</AlertDialogAction
        >
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { playerFields } from "~/graphql/playerFields";

export default {
  data() {
    return {
      team: undefined,
      editTeamSheet: false,
      leaveTeamAlertDialog: false,
      deleteTeamAlertDialog: false,
    };
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
              owner_steam_id: true,
              owner: playerFields,
              roster: [
                {},
                {
                  player: playerFields,
                },
              ],
              matches: [{}, simpleMatchFields],
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
        },
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
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
