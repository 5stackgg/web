<script lang="ts" setup>
import PlayerDisplay from "../PlayerDisplay.vue";
</script>

<template>
  <div
    class="flex items-center justify-between gap-4 px-[0.85rem] py-[0.65rem] border border-dashed border-border bg-muted/15 rounded-md"
  >
    <div class="flex items-center gap-[0.65rem] min-w-0">
      <PlayerDisplay :player="invite.player"></PlayerDisplay>
      <span
        class="px-[0.45rem] py-[0.1rem] font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase bg-muted/40 text-muted-foreground rounded-full"
      >
        {{ $t("tournament.team_invite.pending") }}
      </span>
    </div>
    <AlertDialog>
      <AlertDialogTrigger as-child>
        <Button variant="outline" size="sm">
          {{ $t("tournament.team.cancel_invite") }}
        </Button>
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
  </div>
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
