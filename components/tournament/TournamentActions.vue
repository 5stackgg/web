<script lang="ts" setup>
import { Lock, Unlock, Ban } from "lucide-vue-next";
</script>
<template>
  <DropdownMenu
    v-if="
      tournament.can_open_registration ||
      tournament.can_close_registration ||
      tournament.can_cancel
    "
  >
    <DropdownMenuTrigger as-child>
      <Button variant="secondary" size="icon">
        <PaginationEllipsis class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuItem
        v-if="tournament.can_open_registration"
        @click="openRegistration"
        class="cursor-pointer"
      >
        <Unlock class="mr-2 h-4 w-4" />
        <span>{{ $t("tournament.actions.open_registration") }}</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        v-if="tournament.can_close_registration"
        @click="closeRegistration"
        class="cursor-pointer"
      >
        <Lock class="mr-2 h-4 w-4" />
        <span>{{ $t("tournament.actions.close_registration") }}</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator
        v-if="
          tournament.can_open_registration || tournament.can_close_registration
        "
      />

      <DropdownMenuItem
        v-if="tournament.can_cancel"
        @click="cancel"
        class="text-destructive cursor-pointer"
      >
        <Ban class="mr-2 h-4 w-4" />
        <span>{{ $t("tournament.actions.cancel") }}</span>
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
