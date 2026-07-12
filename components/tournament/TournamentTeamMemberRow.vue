<script lang="ts" setup>
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  ChevronDownIcon,
  Shield,
  LogOut,
  MoreVertical,
  UserMinus,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import Separator from "../ui/separator/Separator.vue";
</script>

<template>
  <div
    class="flex items-center justify-between gap-4 px-[0.85rem] py-[0.65rem] bg-card/50 border border-border rounded-md [transition:border-color_160ms_ease,background_160ms_ease] hover:border-[hsl(var(--tac-amber)/0.35)] hover:bg-card/70"
  >
    <div class="flex items-center gap-[0.65rem] min-w-0 flex-1">
      <PlayerDisplay :player="member.player" :linkable="true" />
    </div>

    <div class="flex flex-shrink-0 items-center gap-2">
      <span
        v-if="isCaptain"
        class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground"
      >
        <Shield class="h-3.5 w-3.5" />
        {{ $t("team.roles.captain") }}
      </span>

      <div v-if="canUpdateRole || hasMenuActions" class="inline-flex isolate">
        <Popover v-if="canUpdateRole" v-model:open="roleMenuOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="h-8 -mr-px !rounded-r-none hover:z-10 focus:z-10"
            >
              {{ member.role }}
              <ChevronDownIcon class="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="p-0" align="end">
            <Command v-model="memberRole">
              <CommandInput :placeholder="$t('tournament.team.select_role')" />
              <CommandList>
                <CommandEmpty>{{
                  $t("tournament.team.no_roles")
                }}</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    v-for="role of roles"
                    :key="role.value"
                    :value="role.value"
                    class="flex flex-col items-start px-4 py-2 cursor-pointer"
                  >
                    <p>{{ role.value }}</p>
                    <p class="text-sm text-muted-foreground">
                      {{ role.description }}
                    </p>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <span
          v-else
          class="inline-flex h-8 items-center border border-border bg-muted/30 px-3 font-mono text-[0.7rem] tracking-[0.18em] uppercase text-muted-foreground rounded-l-md rounded-r-none -mr-px"
        >
          {{ member.role }}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              class="h-8 w-8 !rounded-l-none hover:z-10 focus:z-10"
              :title="$t('common.actions_label')"
            >
              <MoreVertical class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem v-if="canPromoteCaptain" @click="promoteCaptain">
              <Shield />
              {{ $t("match.overview.promote_captain") }}
            </DropdownMenuItem>
            <DropdownMenuSeparator
              v-if="canPromoteCaptain && (canLeaveSelf || canUpdateRole)"
            />
            <DropdownMenuItem
              v-if="canLeaveSelf"
              class="text-destructive"
              @click="$emit('leave')"
            >
              <LogOut />
              {{ $t("tournament.team.leave_team") }}
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="canUpdateRole"
              class="text-destructive"
              :disabled="rosterLockedAtMin"
              :title="
                rosterLockedAtMin
                  ? $t('tournament.team.min_roster_locked')
                  : undefined
              "
              @click="removeMemberDialog = true"
            >
              <UserMinus />
              {{ $t("tournament.team.remove_member") }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <span
        v-else
        class="font-mono text-[0.7rem] tracking-[0.18em] uppercase text-muted-foreground"
      >
        {{ member.role }}
      </span>
    </div>
  </div>

  <AlertDialog :open="removeMemberDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("tournament.team.confirm_remove_member")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{
            $t("tournament.team.remove_member_description", {
              name: member.player.name,
              steam_id: member.player.steam_id,
            })
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="removeMemberDialog = false">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <AlertDialogAction @click.stop="removeMember">{{
          $t("common.confirm")
        }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  emits: ["leave"],
  props: {
    team: {
      type: Object,
      required: true,
    },
    tournament: {
      type: Object,
      required: true,
    },
    member: {
      type: Object,
      required: true,
    },
    roles: {
      type: Array,
      required: true,
    },
    canLeave: {
      type: Boolean,
      default: false,
    },
    rosterLockedAtMin: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      memberRole: undefined,
      removeMemberDialog: false,
      roleMenuOpen: false,
    };
  },
  watch: {
    ["member.role"]: {
      immediate: true,
      handler(role) {
        this.memberRole = role;
      },
    },
    memberRole: {
      handler(role) {
        if (role && this.roles.some((option) => option.value === role)) {
          this.publishRole();
          return;
        }
      },
    },
  },
  computed: {
    isCaptain() {
      return this.member.player.steam_id === this.team.captain_steam_id;
    },
    isCurrentUser() {
      return this.member.player.steam_id === useAuthStore().me?.steam_id;
    },
    canManageTeam() {
      return Boolean(this.tournament?.is_organizer || this.team?.can_manage);
    },
    canLeaveSelf() {
      return this.isCurrentUser && this.canLeave;
    },
    hasMenuActions() {
      return this.canPromoteCaptain || this.canLeaveSelf || this.canUpdateRole;
    },
    canUpdateRole() {
      const me = useAuthStore().me;
      return Boolean(
        me &&
          this.tournament?.is_organizer &&
          this.member.player.steam_id !== me.steam_id,
      );
    },
    canPromoteCaptain() {
      return this.canManageTeam && !this.isCaptain;
    },
  },
  methods: {
    async publishRole() {
      if (!this.canUpdateRole) return;

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_tournament_team_roster_by_pk: [
            {
              _set: {
                role: this.memberRole,
              },
              pk_columns: {
                player_steam_id: this.member.player.steam_id,
                tournament_id:
                  this.$route.params.tournamentId || this.$route.params.id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.roleMenuOpen = false;
    },
    async removeMember() {
      this.removeMemberDialog = false;
      if (!this.canUpdateRole || this.rosterLockedAtMin) return;

      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_team_roster_by_pk: [
            {
              player_steam_id: this.member.player.steam_id,
              tournament_id:
                this.$route.params.tournamentId || this.$route.params.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async promoteCaptain() {
      if (!this.canPromoteCaptain) return;

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_tournament_teams_by_pk: [
            {
              pk_columns: {
                id: this.team.id,
              },
              _set: {
                captain_steam_id: this.member.player.steam_id,
              },
            },
            {
              id: true,
              captain_steam_id: true,
            },
          ],
        }),
      });

      this.roleMenuOpen = false;
    },
  },
};
</script>
