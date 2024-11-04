<script lang="ts" setup>
import TimeAgo from "./TimeAgo.vue";
</script>

<template>
  <div>
    <h3 class="text-lg font-semibold mb-2">
      <template v-if="type === 'tournament'">
        Tournament
        {{ invite.tournament_team_id }}
      </template>
      Team Invite: {{ invite.team.name }}
    </h3>
    <p class="text-sm text-muted-foreground mb-2">
      Invited by {{ invite.invited_by.name }}
      <TimeAgo :date="invite.created_at" class="text-xs" />
    </p>

    <template v-if="type === 'tournament'">
      You have been invited to join the tournament:
      <p class="text-sm text-muted-foreground mb-2">
        <NuxtLink
          :to="`/tournaments/${invite.team.tournament.id}`"
          class="underline"
        >
          {{ invite.team.tournament.name }}
        </NuxtLink>
      </p>
    </template>

    <div class="flex justify-end space-x-2 mt-3">
      <Button variant="outline" @click="denyInvite(invite.id)">Deny</Button>
      <Button variant="default" @click="acceptInvite(invite.id)">Accept</Button>
    </div>
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
    type: {
      type: String,
      required: true,
    },
  },
  methods: {
    async acceptInvite(inviteId: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          acceptInvite: [
            {
              type: this.type,
              invite_id: inviteId,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
    async denyInvite(inviteId: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          denyInvite: [
            {
              type: this.type,
              invite_id: inviteId,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
