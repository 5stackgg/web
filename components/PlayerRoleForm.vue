<script setup lang="ts">
import { Check, ChevronDownIcon } from "lucide-vue-next";
import { e_player_roles_enum } from "~/generated/zeus";
</script>

<template>
  <div
    v-if="list && canChangeRole"
    role="radiogroup"
    :aria-label="$t('pages.players.table.privilege')"
    class="grid divide-y divide-border overflow-hidden rounded-md border border-border"
  >
    <button
      v-for="role of roles"
      :key="role.value"
      type="button"
      role="radio"
      :aria-checked="currentRole === role.value"
      class="flex min-h-11 items-center justify-between gap-3 px-3.5 text-left text-sm transition-colors duration-150 active:bg-muted/50"
      :class="
        currentRole === role.value &&
        'bg-[hsl(var(--tac-amber)/0.08)] font-semibold text-[hsl(var(--tac-amber))]'
      "
      @click="role.value !== currentRole && (memberRole = role.value)"
    >
      {{ role.display }}
      <Check v-if="currentRole === role.value" class="h-4 w-4 shrink-0" />
    </button>
  </div>
  <div
    v-else-if="list"
    class="flex min-h-11 items-center justify-between gap-3 rounded-md border border-dashed border-border px-3.5 text-sm"
  >
    {{ roleLabel }}
    <span class="text-xs text-muted-foreground">{{
      $t("pages.players.outranks_you")
    }}</span>
  </div>
  <Popover v-else-if="canChangeRole" v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm" class="h-7 px-2.5 text-xs">
        <span class="capitalize">{{ roleLabel }}</span>
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
  <span v-else class="text-xs capitalize text-muted-foreground">{{
    roleLabel
  }}</span>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { e_player_roles_enum } from "~/generated/zeus";
import { canEditPlayerRole } from "~/utilities/playerRoleEdit";

export default {
  props: {
    player: {
      type: Object,
      required: true,
    },
    // Every role as a row instead of a dropdown, for a sheet.
    list: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["updated"],
  data() {
    return {
      memberRole: undefined as e_player_roles_enum | undefined,
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
      return canEditPlayerRole(useAuthStore().isRoleAbove, this.player.role);
    },
    currentRole() {
      return this.player.role || e_player_roles_enum.user;
    },
    roleLabel() {
      return this.$t(`player_roles.${this.currentRole}`);
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
          value: e_player_roles_enum.moderator,
          display: this.$t("player_roles.moderator"),
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
