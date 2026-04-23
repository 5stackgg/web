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
import { ChevronDownIcon, Shield } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import Separator from "../ui/separator/Separator.vue";
</script>

<template>
  <div
    class="flex items-center justify-between gap-4 px-[0.85rem] py-[0.65rem] bg-card/50 border border-border rounded-md [transition:border-color_160ms_ease,background_160ms_ease] hover:border-[hsl(var(--tac-amber)/0.35)] hover:bg-card/70"
  >
    <div class="flex items-center gap-[0.65rem] min-w-0 flex-1">
      <PlayerDisplay :player="member.player" />
    </div>

    <div class="flex flex-shrink-0 items-center gap-2">
      <span
        v-if="isCaptain"
        class="inline-flex h-7 items-center gap-1 rounded-sm border border-border/70 bg-muted/25 px-1.5 text-[9px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
      >
        <Shield class="h-3 w-3" />
        {{ $t("team.roles.captain") }}
      </span>

      <Popover v-if="canManageActions" v-model:open="roleMenuOpen">
        <PopoverTrigger as-child>
          <Button variant="outline" size="sm" class="h-8">
            {{ member.role }}
            <ChevronDownIcon class="ml-2 h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent class="p-0" align="end">
          <Command v-model="memberRole">
            <CommandInput :placeholder="$t('tournament.team.select_role')" />
            <CommandList>
              <CommandEmpty>{{ $t("tournament.team.no_roles") }}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  v-if="canUpdateRole"
                  :value="role.value"
                  class="flex flex-col items-start px-4 py-2 cursor-pointer"
                  v-for="role of roles"
                >
                  <p>{{ role.value }}</p>
                  <p class="text-sm text-muted-foreground">
                    {{ role.description }}
                  </p>
                </CommandItem>

                <Separator
                  v-if="canPromoteCaptain || canUpdateRole"
                ></Separator>

                <CommandItem
                  v-if="canPromoteCaptain"
                  :value="'promote-captain'"
                  class="flex px-4 py-2 cursor-pointer"
                  @click.stop="promoteCaptain"
                >
                  <div class="inline-flex items-center gap-2">
                    <Shield class="h-4 w-4" />
                    {{ $t("match.overview.promote_captain") }}
                  </div>
                </CommandItem>

                <CommandItem
                  v-if="canUpdateRole"
                  :value="false"
                  class="flex px-4 py-2 cursor-pointer"
                  @click.stop="removeMemberDialog = true"
                >
                  <div class="text-red-600">
                    {{ $t("tournament.team.remove_member") }}
                  </div>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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
    canManageTeam() {
      return Boolean(this.tournament?.is_organizer || this.team?.can_manage);
    },
    canManageActions() {
      return this.canUpdateRole || this.canPromoteCaptain;
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
      if (!this.canUpdateRole) return;

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
