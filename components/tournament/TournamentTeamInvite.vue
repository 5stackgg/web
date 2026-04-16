<script lang="ts" setup>
import PlayerDisplay from "../PlayerDisplay.vue";
</script>

<template>
  <div class="tournament-invite-row">
    <div class="tournament-invite-row__player">
      <PlayerDisplay :player="invite.player"></PlayerDisplay>
      <span class="tournament-invite-row__tag">{{ $t("tournament.team_invite.pending") }}</span>
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

<style scoped>
.tournament-invite-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0.85rem;
  border: 1px dashed hsl(var(--border));
  background: hsl(var(--muted) / 0.15);
  border-radius: 0.375rem;
}
.tournament-invite-row__player {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}
.tournament-invite-row__tag {
  padding: 0.1rem 0.45rem;
  font-family: "Oxanium", monospace;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  background: hsl(var(--muted) / 0.4);
  color: hsl(var(--muted-foreground));
  border-radius: 9999px;
}
</style>

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
