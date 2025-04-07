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
import { MoreHorizontal, Trash } from "lucide-vue-next";

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
import PageHeading from "~/components/PageHeading.vue";
import MatchesTable from "~/components/MatchesTable.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";

const teamMenu = ref(false);
</script>

<template>
  <div v-if="team" class="grid gap-4">
    <PageHeading>
      <template #title>
        {{ team.name }}
        <span class="text-sm font-semibold text-gray-500 dark:text-gray-400">
          [{{ team.short_name }}]
        </span>
      </template>

      <template #description>
        <PlayerDisplay :player="team.owner" :showSteamId="false">
          <template #name-postfix>
            <Badge variant="secondary">{{ $t("team.roles.captain") }}</Badge>
          </template>
        </PlayerDisplay>
      </template>

      <template #actions>
        <DropdownMenu v-model:open="teamMenu">
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="icon">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-[200px]">
            <DropdownMenuGroup>
              <template v-if="team.owner.steam_id === me.steam_id && isOnTeam">
                <DropdownMenuItem @click="editTeamSheet = true">
                  {{ $t("common.actions.edit") }}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-red-600"
                  @click="deleteTeamAlertDialog = true"
                >
                  <Trash class="mr-2 h-4 w-4 inline" />
                  {{ $t("common.actions.delete") }}
                </DropdownMenuItem>
              </template>
              <template v-else>
                <DropdownMenuItem
                  class="text-red-600"
                  @click="leaveTeamAlertDialog = true"
                >
                  <Trash class="mr-2 h-4 w-4 inline" /> {{ $t("team.leave") }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </template>
    </PageHeading>

    <div class="grid md:grid-cols-2 grid-cols-1 gap-4">
      <div>
        <TeamMembers :team-id="$route.params.id" />
      </div>
      <div>
        <PageHeading>{{ $t("match.recent.title") }}</PageHeading>
        <MatchesTable :matches="team.matches" />
      </div>
    </div>

    <Sheet
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
          <AlertDialogAction @click="deleteTeam">{{
            $t("common.confirm")
          }}</AlertDialogAction>
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
          <AlertDialogAction @click="leaveTeam">{{
            $t("common.confirm")
          }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
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
              invites: [
                {},
                {
                  id: true,
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
        return player.steam_id === this.me.steam_id;
      });
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
