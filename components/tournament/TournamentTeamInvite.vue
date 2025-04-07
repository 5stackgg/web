<script lang="ts" setup>
import PlayerDisplay from "../PlayerDisplay.vue";
</script>

<template>
  <TableRow>
    <TableCell class="font-medium">
      <PlayerDisplay :player="invite.player"></PlayerDisplay>
    </TableCell>
    <TableCell>
      <AlertDialog>
        <AlertDialogTrigger>
          <Button>{{ $t("tournament.team.cancel_invite") }}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{
              $t("tournament.team.confirm_cancel_invite")
            }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{
                $t("tournament.team.cancel_invite_description", {
                  name: invite.player.name,
                  steam_id: invite.player.steam_id,
                })
              }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
            <AlertDialogAction @click="removeInvite">{{
              $t("common.confirm")
            }}</AlertDialogAction>
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
    invite: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async removeInvite() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_team_invites_by_pk: [
            {
              id: this.invite.id,
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
