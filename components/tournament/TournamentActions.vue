<script lang="ts" setup></script>

<template>
  <Button v-if="tournament.can_cancel" @click="cancel"
    >Cancel Tournament</Button
  >
  <Button v-if="tournament.can_open_registration" @click="openRegistration"
    >open Registration</Button
  >
  <Button v-if="tournament.can_close_registration" @click="closeRegistration"
    >Close Registration</Button
  >
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { e_tournament_status_enum } from "~/generated/zeus";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async cancel() {
      await this.updateStatus(e_tournament_status_enum.Cancelled);
    },
    async openRegistration() {
      await this.updateStatus(e_tournament_status_enum.RegistrationOpen);
    },
    async closeRegistration() {
      await this.updateStatus(e_tournament_status_enum.RegistrationClosed);
    },
    async updateStatus(status: e_tournament_status_enum) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_tournaments_by_pk: [
            {
              pk_columns: {
                id: this.tournament.id,
              },
              _set: {
                status,
              },
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
