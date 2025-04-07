<script lang="ts" setup>
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
import { TableCell, TableRow } from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <TableRow>
    <TableCell class="font-medium">
      <PlayerDisplay class="mx-3" :player="organizer"></PlayerDisplay>
    </TableCell>

    <TableCell>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">{{
            $t("tournament.organizer.remove")
          }}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{
              $t("tournament.organizer.confirm_remove")
            }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{
                $t("tournament.organizer.remove_description", {
                  name: organizer.name,
                })
              }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
            <AlertDialogAction @click="removeOrganizer" variant="destructive">
              {{ $t("tournament.organizer.remove") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableCell>
  </TableRow>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    organizer: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async removeOrganizer() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_organizers_by_pk: [
            {
              steam_id: this.organizer.steam_id,
              tournament_id: this.$route.params.tournamentId,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
