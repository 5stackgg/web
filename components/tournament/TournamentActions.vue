<script lang="ts" setup>
import { Lock, Unlock, Ban } from "lucide-vue-next";
</script>
<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon">
        <PaginationEllipsis class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuItem
        v-if="tournament.can_open_registration"
        @click="openRegistration"
      >
        <Unlock class="mr-2 h-4 w-4" />
        <span>Open Registration</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        v-if="tournament.can_close_registration"
        @click="closeRegistration"
      >
        <Lock class="mr-2 h-4 w-4" />
        <span>Close Registration</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        v-if="tournament.can_cancel"
        @click="cancel"
        class="text-destructive"
      >
        <Ban class="mr-2 h-4 w-4" />
        <span>Cancel Tournament</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
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
