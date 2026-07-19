<script setup lang="ts">
import TeamSearch from "~/components/teams/TeamSearch.vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
import { Button } from "~/components/ui/button";
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t("tournament.organizer.teams.title") }}</CardTitle>
      <CardDescription>{{
        $t("tournament.organizer.teams.description")
      }}</CardDescription>
    </CardHeader>
    <CardContent class="grid gap-4">
      <TeamSearch
        :label="$t('tournament.organizer.teams.add')"
        :exclude="linkedTeamIds"
        @selected="addTeam"
      ></TeamSearch>

      <Alert>
        <AlertDescription>
          {{ $t("tournament.organizer.teams.members_note") }}
        </AlertDescription>
      </Alert>

      <Table v-if="linkedTeams.length > 0">
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t("common.name") }}</TableHead>
            <TableHead>{{ $t("common.actions_label") }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="{ team } of linkedTeams" :key="team.id">
            <TableCell class="font-medium">{{ team.name }}</TableCell>
            <TableCell>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">{{
                    $t("tournament.organizer.teams.remove")
                  }}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{{
                      $t("tournament.organizer.teams.remove")
                    }}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {{
                        $t("tournament.organizer.teams.remove_confirm", {
                          name: team.name,
                        })
                      }}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{{
                      $t("common.cancel")
                    }}</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      @click="removeTeam(team.id)"
                    >
                      {{ $t("tournament.organizer.teams.remove") }}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Alert v-else>
        <AlertDescription>
          {{ $t("tournament.organizer.teams.none") }}
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  computed: {
    linkedTeams() {
      return this.tournament.organizer_teams ?? [];
    },
    linkedTeamIds(): string[] {
      return this.linkedTeams.map(({ team_id }: any) => team_id);
    },
  },
  methods: {
    async addTeam(team: { id: string }) {
      if (!team?.id) {
        return;
      }
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_organizer_teams_one: [
            {
              object: {
                tournament_id: this.tournament.id,
                team_id: team.id,
              },
            },
            {
              team_id: true,
            },
          ],
        }),
      });
    },
    async removeTeam(teamId: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_organizer_teams: [
            {
              where: {
                tournament_id: { _eq: this.tournament.id },
                team_id: { _eq: teamId },
              },
            },
            {
              affected_rows: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
