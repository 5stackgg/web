<script lang="ts" setup>
import TimeAgo from "./TimeAgo.vue";
</script>

<template>
  <div>
    <!-- One title, chosen by type. The three invites read almost the same and
         the only thing telling them apart is this line, so it must never show
         two of them at once. -->
    <h3 class="text-lg font-semibold mb-2">{{ title }}</h3>

    <template v-if="isRegistration">
      {{ $t("team.invite.tournament_registration_message") }}
      <p class="text-sm text-muted-foreground mb-2">
        <NuxtLink
          :to="`/tournaments/${invite.tournament.id}`"
          class="underline"
        >
          {{ invite.tournament.name }}
        </NuxtLink>
      </p>
    </template>
    <template v-else-if="isTournamentTeam">
      {{ $t("team.invite.tournament_message", { team: invite.team.name }) }}
      <p class="text-sm text-muted-foreground mb-2">
        <NuxtLink
          :to="`/tournaments/${invite.team.tournament.id}`"
          class="underline"
        >
          {{ invite.team.tournament.name }}
        </NuxtLink>
      </p>
    </template>
    <template v-else>
      {{ $t("team.invite.team_message", { team: invite.team.name }) }}
    </template>

    <div class="flex justify-between space-x-2 mt-3">
      <p class="text-sm text-muted-foreground mb-2">
        {{ $t("team.invite.invited_by", { name: invite.invited_by.name }) }}
        <TimeAgo :date="invite.created_at" class="text-xs" />
      </p>

      <div class="flex gap-2">
        <Button variant="outline" @click="denyInvite(invite.id)">{{
          $t("team.invite.deny")
        }}</Button>
        <Button variant="default" @click="acceptInvite(invite.id)">{{
          $t("team.invite.accept")
        }}</Button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

/**
 * `type` is passed straight through to the shared acceptInvite/denyInvite
 * action, whose dispatch is now explicit and throws on anything it does not
 * know:
 *
 *   "team"                     -> team_invites
 *   "tournament" (legacy) /
 *   "tournament-team"          -> tournament_team_invites  (join a REGISTERED team)
 *   "tournament-registration"  -> tournament_invites       (register at all)
 *
 * The existing call sites still send "tournament": it is what every deployed
 * client sends, and repointing it would break accept/deny mid-upgrade for
 * anyone whose tab has not reloaded.
 */
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
  computed: {
    isRegistration(): boolean {
      return this.type === "tournament-registration";
    },
    isTournamentTeam(): boolean {
      return this.type === "tournament" || this.type === "tournament-team";
    },
    title(): string {
      if (this.isRegistration) {
        return this.$t("team.invite.tournament_registration_title") as string;
      }
      if (this.isTournamentTeam) {
        return this.$t("team.invite.tournament_title") as string;
      }
      return this.$t("team.invite.team_title") as string;
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

      // Accepting a registration invite writes the same
      // tournament_registration_unlocks row the passcode writes, so the
      // tournament page's existing entry gate is already satisfied when we
      // land on it — there is nothing extra to do here.
      if (this.isRegistration) {
        return this.$router.push(`/tournaments/${this.invite.tournament.id}`);
      }
      if (this.isTournamentTeam) {
        return this.$router.push(
          `/tournaments/${this.invite.team.tournament.id}`,
        );
      }
      this.$router.push(`/teams/${this.invite.team.id}`);
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
