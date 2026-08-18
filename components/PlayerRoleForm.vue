<script setup lang="ts">
import { ChevronDownIcon } from "lucide-vue-next";
import { e_player_roles_enum } from "~/generated/zeus";
</script>

<template>
  <Popover v-if="canChangeRole" v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm" class="h-7 px-2.5 text-xs">
        <span class="capitalize">{{
          player.role
            ? $t(`player_roles.${player.role}`)
            : $t("player_roles.user")
        }}</span>
        <ChevronDownIcon class="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
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
import { e_player_roles_enum } from "~/generated/zeus";

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
    // Gate on a fixed "may I edit roles at all" floor, not on whoever's profile
    // happens to be open. Comparing against the *viewed* player's role meant a
    // plain user passed `user >= user` on any other plain user's (public)
    // profile and got a live dropdown they had no permission to submit --
    // hasura grants the players.role column to match_organizer and above only
    // (see api/hasura/metadata .../public_players.yaml update_permissions), so
    // it failed with a raw Hasura error. The `roles` list below still filters
    // to roles at or below the viewer's own.
    canChangeRole() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
    roles() {
      return [
        {
          value: e_player_roles_enum.user,
          display: this.$t("player_roles.user"),
        },
        {
          value: e_player_roles_enum.verified_user,
          display: this.$t("player_roles.verified_user"),
        },
        {
          value: e_player_roles_enum.streamer,
          display: this.$t("player_roles.streamer"),
        },
        {
          value: e_player_roles_enum.match_organizer,
          display: this.$t("player_roles.match_organizer"),
        },
        {
          value: e_player_roles_enum.tournament_organizer,
          display: this.$t("player_roles.tournament_organizer"),
        },
        {
          value: e_player_roles_enum.administrator,
          display: this.$t("player_roles.administrator"),
        },
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
