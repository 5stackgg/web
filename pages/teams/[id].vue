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
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'


import { ref } from 'vue'
import {CornerDownLeft, MoreHorizontal, Trash} from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {FormControl, FormField, FormItem} from "~/components/ui/form";
import {Input} from "~/components/ui/input";
import TeamForm from "~/components/teams/TeamForm.vue";

const teamMenu = ref(false)

</script>

<template>
  <template v-if="team">
    <PageHeading>
      {{ team.name }}

      <DropdownMenu v-model:open="teamMenu">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-[200px]">
          <DropdownMenuGroup>
            <DropdownMenuItem @click="editTeamSheet = true">
              Edit
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem class="text-red-600" @click="deleteTeamAlertDialog = true">
              <Trash class="mr-2 h-4 w-4 inline" /> Delete Team
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <template #description> [{{ team.short_name }}] </template>

    </PageHeading>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <PageHeading> Recent Matches / Scheduled </PageHeading>
        <matches-table :matches="team.matches"></matches-table>
      </div>
      <div>
        <team-members :team-id="$route.params.id"></team-members>
      </div>
    </div>

    <Sheet :open="editTeamSheet" @update:open="(open) => editTeamSheet = open">
      <SheetTrigger></SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editing Team</SheetTitle>
          <SheetDescription>
            <team-form :team="team" @updated="editTeamSheet = false"></team-form>
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>

    <AlertDialog :open="deleteTeamAlertDialog" @update:open="(open) => deleteTeamAlertDialog = open">
      <AlertDialogTrigger class="w-full">
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your team
            and remove associated data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="deleteTeam">Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </template>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { matchFields } from "~/graphql/matchesGraphql";

export default {
  data() {
    return {
      team: undefined,
      editTeamSheet: false,
      deleteTeamAlertDialog: false,
      form: {
        member: undefined,
      },
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
              roster: [
                {},
                {
                  player: {
                    name: true,
                    steam_id: true,
                    avatar_url: true,
                  },
                },
              ],
              invites: [
                {},
                {
                  id: true,
                  player: {
                    name: true,
                    steam_id: true,
                    avatar_url: true,
                  },
                },
              ],
              matches: [{}, matchFields],
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
  watch: {
    ["form.member"]: {
      handler(member) {
        if (member) {
          this.form.member = undefined;
          this.addMember(member.value.steam_id);
        }
      },
    },
  },
  methods: {
    async addMember(steam_id) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_team_invites_one: [
            {
              object: {
                steam_id,
                team_id: this.$route.params.id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async searchPlayers(query) {
      const response = await useFetch("/api/players-search", {
        method: "post",
        body: { query },
      });

      const players = response.data.value.hits.map(({ document }) => {
        return document;
      });

      return players
        .filter((player) => {
          return !this.team.roster.find((member) => {
            return member.player.steam_id === player.steam_id;
          });
        })
        .map((user) => {
          return {
            value: user,
            display: `<img class="inline-block h-[2.875rem] w-[2.875rem] rounded-lg" src="${user.avatar_url}"> ${user.name} <small>[${user.steam_id}]</small>`,
          };
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
  },
};
</script>
