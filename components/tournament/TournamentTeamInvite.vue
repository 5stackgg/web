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
          <Button>Cancel Invite</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancel the invite to {{ invite.player.name }} ({{
                invite.player.steam_id
              }}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction @click="removeInvite"
              >Continue</AlertDialogAction
            >
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
