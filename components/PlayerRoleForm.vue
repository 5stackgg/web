<script setup lang="ts">
import { ChevronDownIcon } from "lucide-vue-next";
import { e_player_roles_enum } from "~/generated/zeus";
</script>

<template>
  <Popover v-if="canChangeRole" v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <Button variant="outline">
        <span class="capitalize">{{
          player.role?.replace("_", " ") || "User"
        }}</span>
        <ChevronDownIcon class="ml-2 h-4 w-4 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="p-0" align="end">
      <Command v-model="memberRole">
        <CommandList>
          <CommandGroup>
            <CommandItem
              :value="role.value"
              class="flex flex-col items-start px-4 py-2 cursor-pointer"
              v-for="role of roles"
            >
              <span class="capitalize">{{ role.display }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    player: {
      type: Object,
      required: true,
    },
  },
  emits: ["updated"],
  data() {
    return {
      memberRole: undefined,
      popoverOpen: false,
    };
  },
  methods: {
    async updateRole() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_players_by_pk: [
            {
              _set: {
                role: this.memberRole,
              },
              pk_columns: {
                steam_id: this.player.steam_id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
      this.popoverOpen = false;
      this.$emit("updated", this.memberRole);
    },
  },
  computed: {
    canChangeRole() {
      return useAuthStore().isRoleAbove(this.player.role);
    },
    roles() {
      return [
        { value: e_player_roles_enum.user, display: "User" },
        { value: e_player_roles_enum.verified_user, display: "Verified User" },
        { value: e_player_roles_enum.streamer, display: "Streamer" },
        {
          value: e_player_roles_enum.match_organizer,
          display: "Match Organizer",
        },
        {
          value: e_player_roles_enum.tournament_organizer,
          display: "Tournament Organizer",
        },
        { value: e_player_roles_enum.administrator, display: "Administrator" },
      ].filter((role) => {
        return useAuthStore().isRoleAbove(role.value);
      });
    },
  },
  watch: {
    memberRole: {
      handler(role) {
        if (role) {
          this.updateRole();
          return;
        }
      },
    },
  },
};
</script>
