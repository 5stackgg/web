<script lang="ts" setup>
import PlayerDisplay from "../PlayerDisplay.vue";
</script>

<template>
  <div class="flex items-center justify-between gap-4 py-1.5">
    <div class="flex items-center gap-[0.65rem] min-w-0">
      <PlayerDisplay :player="invite.player" size="xs"></PlayerDisplay>
      <span class="text-xs text-muted-foreground">
        {{ $t(`tournament.team_invite.pending_${kind}`) }}
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
    // team: joins the team and the lineup; stand_in: the lineup of a
    // team-backed entry only; tournament: a tournament-only team.
    kind: {
      type: String,
      default: "tournament",
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
